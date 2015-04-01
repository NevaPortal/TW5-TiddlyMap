/*\

title: $:/plugins/felixhayashi/tiddlymap/utils.js
type: application/javascript
module-type: library

ATTENTION: THIS CLASS MUST NOT REQUIRE ANY OTHER TIDDLYMAP FILE
IN ORDER TO AVOID ACYCLIC DEPENDENCIES!

@preserve

\*/


(function() {

  /**************************** IMPORTS ****************************/
   
  var vis = require("$:/plugins/felixhayashi/vis/vis.js");
  var Exception = require("$:/plugins/felixhayashi/tiddlymap/exception.js").Exception;

  /***************************** CODE ******************************/

  /**
   * A utilities class that contains universally used helper functions
   * to abbreviate code and make my life easier.
   * 
   * @see Dom utilities {@link https://github.com/Jermolene/TiddlyWiki5/blob/master/core/modules/utils/*}
   * 
   * @namespace
   */
  var utils = {};

  /**
   * Pendant to tw native {@code addTiddlers()}.
   * 
   * @param {TiddlerCollection} tiddlers - A collection of tiddlers to be removed.
   */
  utils.deleteTiddlers = function(tiddlers) {
    
    var keys = Object.keys(tiddlers);
    for(var i = 0; i < keys.length; i++) {
      if(utils.tiddlerExists(tiddlers[keys[i]])) {
        var tRef = utils.getTiddlerRef(tiddlers[keys[i]]);
        $tw.wiki.deleteTiddler(tRef);
      }
    }
    
  };
  
  // TODO: function "delete tiddlers below path
  
  utils.moveFieldValues = function(oldName, newName, isRemoveOldField, isIncludeSystemTiddlers) {
          
    var allTiddlers = $tw.wiki.allTitles();
    for(var i = 0; i < allTiddlers.length; i++) {
      var tObj = utils.getTiddler(allTiddlers[i]);
      if(tObj.isDraft()
         || !tObj.fields[oldName]
         || (!isIncludeSystemTiddlers
             && $tw.wiki.isSystemTiddler(allTiddlers[i]))) {
               continue;
      }
      
      var fields = {};
      fields[newName] = tObj.fields[oldName];
      if(isRemoveOldField) {
        fields[oldName] = undefined;
      }
      $tw.wiki.addTiddler(new $tw.Tiddler(tObj, fields));
      
    }
    
  };

  /**
   * Creates an array of ids based on a given set of tiddlers.
   * 
   * @param {TiddlerCollection} tiddlers - A collection of tiddlers from
   *     which to retrieve the ids.
   * @param {string} idFieldName - The field that identifies the tiddler
   * @return {array.<Id>} - An array of ids.
   */
  utils.getTiddlerIds = function(tiddlers, idFieldName) {
    
    var ids = [];
    var keys = Object.keys(tiddlers);
    for(var i = 0; i < keys.length; i++) {
      if(utils.tiddlerExists(tiddlers[keys[i]])) {
        var id = utils.getTiddler(tiddlers[keys[i]]).fields[idFieldName];
        ids.push(id);
      }
    }
    return ids;
    
  };

  /**
   * @param {Tiddler} tiddler
   * @param {string} aliasField - A tiddler field that contains an
   *     alternative title (e.g. "caption").
   * @return {string|undefined} If the `aliasField` exists and is not
   *     empty, the value of the `aliasField` otherwise the tiddler's
   *     title or undefined if the tiddler doesn't exist.
   */
  utils.getLabel = function(tiddler, aliasField) {
    var tObj = utils.getTiddler(tiddler);
    return (tObj && tObj.fields[aliasField]
            ? tObj.fields[aliasField]
            : tObj.fields.title);
  };

  /**
   * Transforms a collection of a certain type into a collection of
   * another type.
   * 
   * **Attention**: When trying to convert an array into a object, the
   * array will be simply bounced back. Let's hope no one added enumerable
   * properties to Array.prototype :)
   * 
   * @param {Collection} col - The collection to convert.
   * @param {CollectionTypeString} [outputType="dataset"] - The output type.
   * @return {Collection} A collection of type `outputType`.
   */
  utils.convert = function(col, outputType) {
    
    if(typeof col !== "object") return;
    
    switch(outputType) {
      
      case "array":
        return utils.getValues(col);
      case "hashmap": // fall through alias
      case "object":
        if(col instanceof vis.DataSet) { // a dataset
          return vis.get({ returnType: "Object" }); // careful has proto
        } else { // object (array is an object itself)
          return col; // bounce back
        }
        
      case "dataset":
      default:
        if(col instanceof vis.DataSet) {
          return col; // bounce back
        }
        if(!Array.isArray(col)) {
          col = utils.getValues(col);
        }
              
        return new vis.DataSet(col);

    }
    
  };

  /**
   * Injects the values of setA into setB. Note that setB will only
   * contain distinct values.
   * 
   * **Note**: Properties are not cloned.
   * 
   * @param {Collection} setA - Collection from which values are read.
   * @param {Collection} setB - Collection into which values are merged.
   * @return {Collection} setB
   */
  utils.inject = function(setA, setB) {

    if(setB instanceof vis.DataSet) { // output is a dataset
      setB.update(utils.convert(setA, "array"));
    } else if(Array.isArray(setB)) { // output is an array
      setA = utils.convert(setA, "object");
      for(var p in setA) {
        if(!utils.inArray(setA[p], setB)) { // not contained yet
          setB.push(setA[p]);
        }
      }
    } else { // assume normal object
      $tw.utils.extend(setB, utils.convert(setA, "object"));
    }
    
    return setB;
    
  };
  
  /**
   * using an existing dataset to reflect the changes between
   * two node sets.
   * 
   * @param {Hashmap<id, Node>} lt1 - Lookup table that contains the
   *     *new* set of nodes.
   * @param {Hashmap<id, Node>} lt2 - lookup table that holds the
   *     *old* set of nodes.
   * @param {vis.DataSet} [ds] - The dataset to be updated
   */
  utils.refresh = function(ltNew, lTOld, ds) {
    
    if(!ds) {
      return new vis.DataSet(utils.convert(ltNew, "array"));
    }
        
    var changes = {
      updated: utils.convert(ltNew, "array"),
      removed: []
    };
    
    for(var id in lTOld) {
      if(!ltNew[id]) {
        changes.removed.push(id);
      }
    }
    
    ds.remove(changes.removed); // remove before update!
    ds.update(changes.updated);
    
    return ds;
    
  };

  /**
   * Extract all the values from a collection. If `col` is an object,
   * only properties are considered that are its own and iterable.
   * 
   * @param {Collection} col
   * @return {Array} An array
   */
  utils.getValues = function(col) {
    
    if(Array.isArray(col)) {
      return col; // bounce back.
    } if(col instanceof vis.DataSet) { // a dataset
      return col.get({ returnType: "Array" });
    }
    
    var result = [];
    var keys = Object.keys(col);
    for(var i = 0; i < keys.length; i++) {
      result.push(col[keys[i]]);
    }
    
    return result;
    
  };

  /**
   * I use this method on all objects that I didn't create myself.
   * 
   * Why this? Well,
   * 
   * 1. How do I know if the object was created via {} or utils.getDataMap()?
   *    If the latter is the case, `hasOwnProperty()` doesn't exist.
   * 2. When the object is used as hashtable, hasOwnProperty could be overridden.
   *    
   * @see http://www.2ality.com/2012/01/objects-as-maps.html
   * 
   * Hope ECMA6 is out soon with dedicated datastructures.
   * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map
   * 
   * @param {Object} obj - The object.
   * @param {*} key - The key.
   * @result {boolean} True if key is the own property of obj.
   */ 
  utils.hasOwnProp = function(obj, key) {
    return Object.prototype.hasOwnProperty.call(obj, key);
  }

  /**
   * Factory function to return a prototypeless object that is used as
   * map. It only has the property hasOwnProperty in order to to be
   * exchangeble with other framworks that depend on this method like 
   * e.g. visjs.
   */
  utils.getDataMap = function() {
    
    var map = Object.create(null);
    Object.defineProperty(map, "hasOwnProperty", {
      enumerable: false,
      configurable: false,
      writable: false,
      value: Object.prototype.hasOwnProperty.bind(map)
    });
    
    return map;
    
  };

  /**
   * This function facilitates to check whether a list of tiddlers
   * matches a certain filter. If the tiddler does not exist, it is not
   * returned as match. If no list is specified, all tiddlers in
   * the wiki are considered.
   * 
   * @param {TiddlyWikiFilter} filter - The filter to use.
   * @param {TiddlerCollection} [tiddlers] - A set of tiddlers used as source.
   * @param {Hashmap} [options] - An optional options object.
   * @param {string} [options.outputType="array"] - May either be
   *     set to "array" or "hashmap". When set to "hashmap", the result
   *     container will not be an array but a hashmap with tiddler
   *     titles being the keys and `$tw.Tiddler` objects the values.
   * @return {Array.<TiddlerReference>|Hashmap.<Id, $tw.Tiddler>}
   */
  utils.getMatches = function(filter, tiddlers, asHashmap) {
        
    // use wiki as default source
    var source = undefined;
    
    if(tiddlers !== null && typeof tiddlers === "object") {
      var keys = Object.keys(tiddlers);
      source = function(iterator) {
        for(var i = 0; i < keys.length; i++) {
          var tObj = utils.getTiddler(tiddlers[keys[i]]);
          if(tObj) {
            iterator(tObj, tObj.fields.title);
          }
        }
      };
    }
    
    if(typeof filter === "string") {
      filter = $tw.wiki.compileFilter(filter);
    }
    
    var tRefs = filter.call($tw.wiki, source);
    
    if(asHashmap) {
      var lookupTable = utils.getDataMap();
      for(var i = 0; i < tRefs.length; i++) {
        lookupTable[tRefs[i]] = $tw.wiki.getTiddler(tRefs[i]);
      }
      return lookupTable;
    } else {
      return tRefs;
    }
        
  };

  /**
   * Tries to match a single tiddler object against a filter.
   * Returns a boolean value.
   * 
   * @param {Tiddler} tiddler - The object to apply the filter to.
   * @param {TiddlyWikiFilter} filter - The filter to use.
   * @return {boolean} True if the tiddler matches the filter, false otherwise.
   */
  utils.isMatch = function(tiddler, filter) {
    
    var tRef = utils.getTiddlerRef(tiddler);
    return (utils.getMatches(filter, [ tRef ]).length > 0);
    
  };
  
  /**
   * Sadly, setting fields with tw means that we lose the type information
   * since field values are persisted as strings and the type is not
   * included.
   * 
   * To ensure that flags are always interpreted correctly, the following
   * function exists.
   * 
   * We regard the following values as `true` (order matters):
   * 
   * # Any string that can be translated into a number unequal `0`
   * # `"true"`
   * # Any number unequal `0`
   * # Boolean `true`
   * 
   * The following as false (order matters):
   * 
   * # Any string that can be translated into number `0`
   * # Every string unequal `"true"`
   * # The number `0`
   * # Boolean `false`
   * 
   */
  utils.isTrue = function(confVal, defVal) {
    
    if(confVal == null) {
      return defVal;
    } else if(typeof confVal === "string") {
      var n = parseInt(confVal);
      return (isNaN(n) ? (confVal === "true") : (n !== 0));
      if(confVal === "1" || this.data[conf] === "true");
    } else if(typeof confVal === "boolean") {
      return confVal;
    } else if(typeof confVal === "number") {
      return (n !== 0);
    }
    
    return false;
    
  };

  /**
   * Gets a tiddler reference from a tRef or tObj
   * 
   * @param {Tiddler} tiddler - A tiddler reference or object.
   * @return {TiddlerReference|undefined} A tiddler reference (title)
   */
  utils.getTiddlerRef = function(tiddler) {
    
    if(tiddler instanceof $tw.Tiddler) {
      return tiddler.fields.title;
    } else if(typeof tiddler === "string") {
      return tiddler;
    }
    
  };

  /**
   * Similar to {@code wiki.getTiddler()} but also accepts a tObj as
   * argument, thus, making it unnecessary to always differentiate or remember
   * if we are dealing with an object or a reference.
   * 
   * @see https://github.com/Jermolene/TiddlyWiki5/blob/master/boot/boot.js#L866
   * @param {Tiddler} tiddler - A tiddler reference or object.
   * @param {boolean} isReload - If set to true the tiddler freshly reloaded
   *     from the db and any potentially passed tiddler object is ignored.
   * @return {Tiddler} A tiddler object.
   */
  utils.getTiddler = function(tiddler, isReload) {
    
    if(tiddler instanceof $tw.Tiddler) {
      if(!isReload) {
        return tiddler;
      }
      tiddler = tiddler.fields.title;
    }
    
    return $tw.wiki.getTiddler(tiddler);
    
  };

  /**
   * Returns the basename of a path. A path is a string with slashes.
   * 
   * @param {string} path - The path
   * @return {string} The basename
   */
  utils.getBasename = function(path) {
    
    return path.substring(path.lastIndexOf('/') + 1);
    
  };

  /**
   * This function uses the tw-notification mechanism to display a
   * temporary message.
   * 
   * @see https://github.com/Jermolene/TiddlyWiki5/blob/master/core/modules/utils/dom/notifier.js
   * @param {string} message - A short message to display.
   */
  utils.notify = function(message) {
    
    var tRef = "$:/temp/tiddlymap/notify";
    $tw.wiki.addTiddler(new $tw.Tiddler({
      title : tRef, text : message
    }));
    $tw.notifier.display(tRef);
    
  };

  /**
   * Checks if tiddlers (including shadow tiddlers) exist.
   * 
   * @param {Tiddler} tiddler
   * @return {boolean} True if the tiddler exists, false otherwise
   */
  utils.tiddlerExists = function(tiddler) {
    
    var tRef = utils.getTiddlerRef(tiddler);
    return tRef && ($tw.wiki.tiddlerExists(tRef) || $tw.wiki.isShadowTiddler(tRef));
    
  };
  
  /**
   * Register listeners to widget using a hashmap.
   * 
   * @param {Hashmap<Key, Function>} listeners - The listeners to attach.
   * @param {Widget} widget - the widget to attach the listeners to.
   * @param {Object} context - The context to bind the listeners to.
   */
  utils.addListeners = function(listeners, widget, context) {
    for(var id in listeners) {
      widget.addEventListener(id, listeners[id].bind(context));
    }
  };

  /**
   * Returns a new object that contains only properties that start with
   * a certain prefix. The prefix is optionally removed from the result.
   * 
   * @param {Object} obj
   * @param {string} prefix - The start sequence
   * @param {boolean} [removePrefix=false] - True if the prefix shall be removed
   *     from the resulting property name, false otherwise.
   * @result {object}
   */
  utils.getPropertiesByPrefix = function(obj, prefix, removePrefix) {
    
      var r = utils.getDataMap();
      for(var p in obj) {
        if(utils.startsWith(p, prefix)) {
          r[(removePrefix ? p.substr(prefix.length) : p)] = obj[p];
        }
      }
    
    return r;
    
  };
  
  utils.getWithoutPrefix = function(str, prefix) {

    return (utils.startsWith(str, prefix)
            ? str.substr(prefix.length)
            : str);

  };

  /**
   * Helper to increase the code semantics.
   * @param {string} str - The string to work with.
   * @param {string} prefix - The sequence to test.
   * @result {boolean} True if `str` starts with `prefix`, false otherwise.
   */
  utils.startsWith = function(str, prefix) {
    
    return (typeof str === "string" && str.indexOf(prefix) === 0);
    
  };

  /**
   * Function to find out whether an object has any enumerable properties
   * or, in case of an array, elements.
   * 
   * @param {Object} obj
   * @return {boolean} True if at least one enumerable property exists,
   *     false otherwise.
   */
  utils.hasElements = function(obj) {
    
    return (Object.keys(obj).length > 0);
    
  };
  
  /**
   * 
   * 
   */
  utils.groupByProperty = function(col, prop) {
    
    col = utils.getIterableCollection(col);
    
    var result = utils.getDataMap();
    var keys = Object.keys(col);
    for(var i in keys) {
      var item = col[keys[i]];
      var val = item[prop];
      if(val == null) { // null or undefined
        throw "Cannot group by property " + prop;
      } else {
        if(!Array.isArray(result[val])) {
          result[val] = [];
        }
        result[val].push(item);
      }
    }
    
    return result;
    
  };

  /**
   * Searches the dom for elements that possess a certain class
   * and removes this class from each element.
   * 
   * @param {Array<string>} classNames - The class names to remove.
   */
  utils.findAndRemoveClassNames = function(classNames) {
    
    for(var i = 0; i < classNames.length; i++) {
      var elements = document.getElementsByClassName(classNames[i]);
      for(var j = 0; j < elements.length; j++) {
        $tw.utils.removeClass(elements[j], classNames[i]);
      }
    }

  };
  
  /**
   * Parse json from field or return default value on error.
   * 
   * @param {Tiddler} tiddler - The tiddler containing the json.
   * @param {string} field - The field with the json data.
   * @param {Object} [data] - An optional default value.
   * @return {*} Either the parsed data or the default data.
   */
  utils.parseFieldData = function(tiddler, field, data) {
    
    var tObj = utils.getTiddler(tiddler);
    if(!tObj) throw "tmap: Cannot parse field of " + tiddler;
    
    if(!field) field = "text";
    
    return utils.parseJSON(tObj.fields[field], data);
    
  };
  
  /**
   * Try to turn the string into a javascript object. If the
   * transformation fails, return the optionally provided `data` object.
   * 
   * @param {string} str - The string to parse.
   * @param {*} data - The default value if the operation fails.
   * @return {*} Either the object resulting from the parsing operation
   *     or `null` or `data` if the operation failed.
   */
  utils.parseJSON = function(str, data) {

    try {
      return JSON.parse(str);
    } catch(Error) {
      return data;
    }
    
  };

  /**
   * Serialize json data and store it in a tiddler's field.
   * 
   * @param {Tiddler} tiddler - The tiddler to store the json in.
   * @param {string} field - The field that will store the json.
   * @param {Object} data - The json data.
   */
  utils.writeFieldData = function(tiddler, field, data) {

    if(typeof data === "object") {
      utils.setField(tiddler, field, JSON.stringify(data));
    }
    
  };

  /**
   * Turns the filter expression in a nicely formatted (but unusable)
   * text, making it easier to edit long filter expressions.
   * 
   * @param {string} expr - A valid filter expression.
   * @result {string} A formatted (unusable) filter expression.
   */
  utils.getPrettyFilter = function(expr) {
    
    // remove outer spaces and separate operands
    expr = expr.trim().replace("][", "] [");
    
    // regex to identify operands 
    var re = /[\+\-]?\[.+?[\]\}\>]\]/g;
    
    // get operands
    var operands = expr.match(re);
    
    // replace operands with dummies and trim again to avoid trailing spaces
    expr = expr.replace(re, " [] ").trim();
    
    // turn it into an array
    var stringsPlusDummies = expr.split(/\s+/);

    var operandIndex = 0;
    var parts = [];
    for(var i = 0; i < stringsPlusDummies.length; i++) {
      parts[i] = (stringsPlusDummies[i] === "[]"
                ? operands[operandIndex++]
                : stringsPlusDummies[i]);
    }
      
    return parts.join("\n");

  };
  
  /**
   * Set a tiddler field to a given value 
   */
  utils.setField = function(tiddler, field, value) {

    if(tiddler && field) {
      var fields = {
        title: utils.getTiddlerRef(tiddler)
      };
      fields[field] = value;
      // do not use any tObj provided since it may result in a lost update
      var tObj = utils.getTiddler(tiddler, true);
      $tw.wiki.addTiddler(new $tw.Tiddler(tObj, fields));
    }
    
  };

  /**
   * Set the value of a data tiddler entry (index) to a given value
   */
  utils.setEntry = function(tiddler, prop, value) {

    $tw.wiki.setText(utils.getTiddlerRef(tiddler), null, prop, value);

  };
  
  /**
   * Get the value of a data tiddler entry (index)
   */
  utils.getEntry = function(tiddler, prop, defValue) {

    var data = $tw.wiki.getTiddlerData(utils.getTiddlerRef(tiddler), {});
    return (data[prop] == null ? defValue : data[prop]);
    
  };
  
  
  /**
   * Get a tiddler's field value. If the field does not exist or
   * its value is an empty string, return the default or an empty
   * string.
   */
  utils.getField = function(tiddler, field, defValue) {
    
    var tObj = utils.getTiddler(tiddler);
    return (tObj ? tObj.fields[field] : (defValue ? defValue : ""));
    
  };
  
  utils.getText = function(tiddler, defValue) {
    
    return utils.getField(tiddler, "text", defValue);
    
  };
    
  /**
   * Checks whether a tiddler is a draft or not.
   * @param {Tiddler} tiddler - The tiddler to check on.
   */
  utils.isDraft = function(tiddler) {

    return (utils.getTiddler(tiddler) && utils.getTiddler(tiddler).isDraft());

  };
  
  /**
   * Merges `src` into `dest` which means that the merge transforms
   * the `dest` object itself. If src and dest both have the same
   * property path, src does only replace the primitive data type
   * at the end of the path.
   * 
   * @param {Object} dest - The destination object.
   * @param {Object} src - The object to merge into `dest`.
   * @return {Object} The original `dest` object.
   */
  utils.merge = function(dest, src) {
    
    var _merge = function(dest, src) {
      
      if(typeof dest !== "object") { dest = {}; }
      
      for(var p in src) {
        if(src.hasOwnProperty(p)) {
          if(src[p] != null) { // skip null or undefined
            dest[p] = (typeof src[p] === "object"
                       ? _merge(dest[p], src[p])
                       : src[p]); // primitive type, stop recursion
          }
        }
      }
        
      return dest;
    };
    
    return _merge(dest, src);

  };
  
  /**
   * Rastafarianism, jaaaah
   */
  utils.drawRaster = function(canvas, raster, color) {
    
    raster = parseInt(raster) || 10;
    var context = canvas.getContext("2d");
    var vLines = canvas.width / raster;
    var hLines = canvas.height / raster;
        
    // draw vertical lines
    for(var x = 0; x < canvas.width; x += raster) {
      context.moveTo(x, 0);
      context.lineTo(x, canvas.height);
    }
        
    // draw horizontal lines
    for(var y = 0; y < canvas.height; y += raster) {
      context.moveTo(0, y);
      context.lineTo(canvas.width, y);
    }

    context.strokeStyle = color || "black";
    context.stroke();

  };
  
  /**
   * Get a tiddler's text or otherwise return a default text.
   */
  utils.isSystemOrDraft = function(tiddler) {

    if($tw.wiki.isSystemTiddler(utils.getTiddlerRef(tiddler))) {
      return true;
    } else {
      var tObj = utils.getTiddler(tiddler);
      return (tObj && tObj.isDraft());
    }
    
  };
  
  /**
   * Checks if a value exists in an array. A strict search is used
   * which means that also the type of the needle in the haystack
   * is checked.
   * 
   * @param {*} needle - The searched value.
   * @param {Array} - The array.
   * @return Returns true if needle is found in the array, false otherwise. 
   */
  utils.inArray = function(needle, haystack) {
    
    return (haystack.indexOf(needle) !== -1);
    
  };
  
  /**
   * Checks if a string exists in a string.
   */
  utils.hasSubString = function(str, sub) {
    
    return (str.indexOf(sub) !== -1);
    
  };
  
  /**
   * Joins all elements of an array into a string where all elements
   * are wrapped between `left` and `right`.
   * 
   * @param {Array} arr - The array to perform the join on.
   * @param {string} left - The wrapping string for the left side.
   * @param {string} right - The wrapping string for the right side.
   * @param {string} separator - The separator between a wrapped element
   *     and the next one.
   * @return {string} The wrapped string, e.g. `[[hello]] [[world]]`.
   */
  utils.joinAndWrap = function(arr, left, right, separator) {
        
    if(!separator) separator = " ";
    return left + arr.join(right + separator + left) + right;
    
  };

  /**
   * Function that searches an array containing objects for an object
   * with a property having certain value. 
   * 
   * Attention: Not the item itself but the item's key is returned.
   * 
   * @param {Collection} col - The collection to search in.
   * @param {string} key - The property name to look for.
   * @param {*} [val] - An optional value that the object's property must have
   *     in order to match.
   * @param {number} [limit] - An optional result limit (>0) to stop the search.
   * @return {Array<Id>} An array containing the indeces of matching items.
   */
  utils.keysOfItemsWithProperty = function(col, key, val, limit) {
    
    col = utils.getIterableCollection(col);
    
    var keys = Object.keys(col);
    var result = [];
    var limit = (typeof limit === "number" ? limit : keys.length);
    for(var i = 0; i < keys.length; i++) {
      var index = keys[i];
      if(typeof col[index] === "object" && col[index][key]) {
        if(!val || col[index][key] === val) {
          result.push(index);
          if(result.length === limit) {
            break;
          }
        }
      }
    }
    
    return result;
    
  };

  /**
   * 
   * 
   */
  utils.keyOfItemWithProperty = function(col, key, val) {
    var keys = utils.keysOfItemsWithProperty(col, key, val, 1)
    return (keys.length ? keys[0] : undefined);
  };
  
  /**
   * Delete all tiddlers with a given prefix.
   * 
   * @param {string} prefix - The prefix
   */
  utils.deleteByPrefix = function(prefix) {
    
    utils.deleteTiddlers(utils.getByPrefix(prefix));
    
  };
  
  /**
   * Get all tiddlers with a given prefix.
   * 
   * @param {string} prefix - The prefix
   */
  utils.getByPrefix = function(prefix) {
    
    return utils.getMatches("[prefix[" + prefix + "]]");
    
  };

  /**
   * This function will return a collection object whose data can be
   * via `Object.keys(col)` in a loop.
   * 
   * @param {Collection} col - A collection
   * @return {Hashmap} The iterable object.
   */
  utils.getIterableCollection = function(col) {
    
    return (col instanceof vis.DataSet ? col.get() : col);

  };

  /**
   * In a collection where all elements have a **distinct** property `x`,
   * use the value of each properties `x` as key to identify the object.
   * If no property `x` is specified via `lookupKey`, the collection's
   * values are used as keys.
   * 
   * @param {Collection} col - The collection for which to create a lookup table.
   * @param {string} [lookupKey] - The property name to use as index in
   *     the lookup table. If not specified, the collection values are tried
   *     to be used as indeces.
   * @return {Hashmap} The lookup table.
   */
  utils.getLookupTable = function(col, lookupKey) {
    
    col = utils.getIterableCollection(col);
    
    var lookupTable = utils.getDataMap();
    
    var keys = Object.keys(col);
    for(var i = 0; i < keys.length; i++) {
      
      var key = keys[i];
      
      // value to be used as the lookup table's index
      var ltIndex = (lookupKey ? col[key][lookupKey] : col[key]);
      
      if((typeof ltIndex === "string" && ltIndex != "") || typeof ltIndex === "number") {
        if(!lookupTable[ltIndex]) { // doesn't exist yet!
          lookupTable[ltIndex] = col[key];
          continue;
        }
      }

      // in any other case
      throw "TiddlyMap: Cannot use \"" + ltIndex + "\" as lookup table index";
      
    }
    
    return lookupTable;
      
  };
    
  /**
   * Wrapper for {@link utils.getLookupTable}
   */
  utils.getArrayValuesAsHashmapKeys = function(arr) {
    
    return utils.getLookupTable(arr);
    
  };

  /**
   * Returns all tiddlers that possess a property with a certain value.
   * 
   * @param {string} fieldName - The property name to look for.
   * @param {string} [value] - If provided, the field's value must
   *     equal this value in order to match.
   * @param {Hashmap} [options] - Further options.
   * @param {TiddlerCollection} [options.tiddlers=$tw.wiki.allTitles()] - A collection
   *     of tiddlers to perform the search on.
   * @param {boolean} [options.isIncludeDrafts=false] - True if drafts of the found
   *     tiddlers are also included in the result set.
   * @param {number} [options.limit] - A positive number delimiting the maximum
   *     number of results.
   *     tiddlers are also included in the result set.
   * @return {Hashmap.<TiddlerReference, Tiddler>} Result
   */
  utils.getTiddlersWithField = function(fieldName, value, options) {
    
    
    if(!options || typeof options !== "object") options = {};
    
    var result = utils.getDataMap();
    
    var tiddlers = (options.tiddlers ? options.tiddlers : $tw.wiki.allTitles());
    var limit = (options.limit ? options.limit : 0);
    var isIncludeDrafts = (options.isIncludeDrafts === true);
    var result = utils.getDataMap();
    var keys = Object.keys(tiddlers);
    for(var i = 0; i < keys.length; i++) {
      var tObj = utils.getTiddler(tiddlers[keys[i]]);
      if(tObj.hasField(fieldName) && (!tObj.isDraft() || isIncludeDrafts)) {
        if(!value || tObj.fields[fieldName] === value ) {
          result[tObj.fields.title] = tObj;
          if(--limit === 0) break;
        }
      }
    }
        
    return result;
    
  };
  
  /**
   * Creates an uncompiled filter expression.
   */
  utils.getPrefixFilter = function(prefix, marker, isOnlyBasename) {
    
    return "["
           + "all[tiddlers+shadows]prefix[" + prefix + "]"
           + "!has[draft.of]"
           + (marker ? "has[" + marker + "]" : "")
           + (isOnlyBasename ? "removeprefix[" + prefix + "/]" : "")
           + "]";
           
  };
  
  /**
   * Contains all TiddlyMap exceptions
   */
  utils.Exception = Exception;

  /************************* 3rd-party code **************************/

  /**
   * TW-Code
   * @deprecated delete this in 2016 and use $tw.utils.getFullScreenApis instead
   */
  utils.getFullScreenApis = function() {
    var d = document,
      db = d.body,
      result = {
      "_requestFullscreen": db.webkitRequestFullscreen !== undefined ? "webkitRequestFullscreen" :
                db.mozRequestFullScreen !== undefined ? "mozRequestFullScreen" :
                db.msRequestFullscreen !== undefined ? "msRequestFullscreen" :
                db.requestFullscreen !== undefined ? "requestFullscreen" : "",
      "_exitFullscreen": d.webkitExitFullscreen !== undefined ? "webkitExitFullscreen" :
                d.mozCancelFullScreen !== undefined ? "mozCancelFullScreen" :
                d.msExitFullscreen !== undefined ? "msExitFullscreen" :
                d.exitFullscreen !== undefined ? "exitFullscreen" : "",
      "_fullscreenElement": d.webkitFullscreenElement !== undefined ? "webkitFullscreenElement" :
                d.mozFullScreenElement !== undefined ? "mozFullScreenElement" :
                d.msFullscreenElement !== undefined ? "msFullscreenElement" :
                d.fullscreenElement !== undefined ? "fullscreenElement" : "",
      "_fullscreenChange": d.webkitFullscreenElement !== undefined ? "webkitfullscreenchange" :
                d.mozFullScreenElement !== undefined ? "mozfullscreenchange" :
                d.msFullscreenElement !== undefined ? "MSFullscreenChange" :
                d.fullscreenElement !== undefined ? "fullscreenchange" : ""
    };
    if(!result._requestFullscreen || !result._exitFullscreen || !result._fullscreenElement) {
      return null;
    } else {
      return result;
    }
  };

  /**
   * 
   * Slightly modified by me to allow an optional prefix.
   * 
   * For the original code:
   * 
   * Copyright (c) 2014, Hugh Kennedy, All rights reserved.
   * Code published under the BSD 3-Clause License
   * 
   * @see oringal repo https://github.com/hughsk/flat
   * @see snapshot https://github.com/felixhayashi/flat
   * @see http://opensource.org/licenses/BSD-3-Clause
   */
  utils.flatten = function(target, opts) {
    
    opts = opts || {}

    var delimiter = opts.delimiter || '.'
    var prefix = opts.prefix || ''
    var output = {}

    function step(object, prev) {
      Object.keys(object).forEach(function(key) {
        var value = object[key]
        var isarray = opts.safe && Array.isArray(value)
        var type = Object.prototype.toString.call(value)
        var isobject = (
          type === "[object Object]" ||
          type === "[object Array]"
        )

        var newKey = prev
          ? prev + delimiter + key
          : prefix + key

        if (!isarray && isobject) {
          return step(value, newKey)
        }

        output[newKey] = value
      })
    }

    step(target)

    return output;
    
  };


  /**
   * Copyright (c) 2014, Hugh Kennedy, All rights reserved.
   * Code published under the BSD 3-Clause License
   * 
   * @see oringal repo https://github.com/hughsk/flat
   * @see snapshot https://github.com/felixhayashi/flat
   * @see http://opensource.org/licenses/BSD-3-Clause
   */
  utils.unflatten = function(target, opts) {
    
    opts = opts || {}

    var delimiter = opts.delimiter || '.'
    var result = {}

    if (Object.prototype.toString.call(target) !== '[object Object]') {
      return target
    }

    // safely ensure that the key is
    // an integer.
    function getkey(key) {
      var parsedKey = Number(key)

      return (
        isNaN(parsedKey) ||
        key.indexOf('.') !== -1
      ) ? key
        : parsedKey
    }

    Object.keys(target).forEach(function(key) {
      var split = key.split(delimiter)
      var key1 = getkey(split.shift())
      var key2 = getkey(split[0])
      var recipient = result

      while (key2 !== undefined) {
        if (recipient[key1] === undefined) {
          recipient[key1] = (
            typeof key2 === 'number' &&
            !opts.object ? [] : {}
          )
        }

        recipient = recipient[key1]
        if (split.length > 0) {
          key1 = getkey(split.shift())
          key2 = getkey(split[0])
        }
      }

      // unflatten again for 'messy objects'
      recipient[key1] = utils.unflatten(target[key], opts)
    })

    return result;

  };


  /**
   * An adopted version of pmario's version to create
   * uuids of type RFC4122, version 4 ID.
   * 
   * Shortened version:
   * pmario (1.0 - 2011.05.22):
   * http://chat-plugins.tiddlyspace.com/#UUIDPlugin
   * 
   * Original version:
   * Math.uuid.js (v1.4)
   * http://www.broofa.com
   * mailto:robert@broofa.com
   * 
   * Copyright (c) 2010 Robert Kieffer
   * Dual licensed under the MIT and GPL licenses.
   * 
   * ---
   * @see https://github.com/almende/vis/issues/432
  */
  utils.genUUID = (function() {
    
    // Private array of chars to use
    var CHARS = '0123456789abcdefghijklmnopqrstuvwxyz'.split(''); 

    return function () {
      var chars = CHARS, uuid = new Array(36);

      var rnd=0, r;
      for (var i = 0; i < 36; i++) {
        if (i==8 || i==13 ||  i==18 || i==23) {
          uuid[i] = '-';
        } else if (i==14) {
          uuid[i] = '4';
        } else {
          if (rnd <= 0x02) rnd = 0x2000000 + (Math.random()*0x1000000)|0;
          r = rnd & 0xf;
          rnd = rnd >> 4;
          uuid[i] = chars[(i == 19) ? (r & 0x3) | 0x8 : r];
        }
      } 
      
      return uuid.join('');
    };

  })();
  
  // !! EXPORT !!
  exports.utils = utils;
  // !! EXPORT !!
  
})();