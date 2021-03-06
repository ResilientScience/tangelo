(function(){
vg = {version:"0.0.1"};
// Logging and Error Handling

vg.log = function(msg) {
  if (console && console.log) console.log(msg);
};

vg.error = function(msg) {
  throw new Error(msg);
};

// Type Utilities

var toString = Object.prototype.toString;
var vg_ref_char = "@";
var vg_ref_regex = /\[|\]|\./;

vg.isObject = function(obj) {
  return obj === Object(obj);
};

vg.isFunction = function(obj) {
  return toString.call(obj) == '[object Function]';
};

vg.isString = function(obj) {
  return toString.call(obj) == '[object String]';
};
  
vg.isArray = Array.isArray || function(obj) {
  return toString.call(obj) == '[object Array]';
};

// Object and String Utilities

vg.extend = function(obj) {
  for (var i=1, len=arguments.length; i<len; ++i) {
    var source = arguments[i];
    for (var prop in source) obj[prop] = source[prop];
  }
  return obj;  
};

vg.clone = function(obj) {
  if (!vg.isObject(obj)) return obj;
  return vg.isArray(obj) ? obj.slice() : vg.extend({}, obj);
};

vg.copy = function(obj) {
  return JSON.parse(JSON.stringify(obj));
};

vg.repeat = function(str, n) {
  for (var s="", i=0; i<n; ++i) s += str;
  return s;
};

vg.str = function(str) {
  return vg.isArray(str) ? "[" + str.map(vg.str) + "]"
       : vg.isString(str) ? ("'"+str+"'") : str;
};

// Value and Data Reference Handling

vg.value = function(enc) {
  if (enc === undefined) enc = {};
  if (vg.isArray(enc) || !vg.isObject(enc)) { return vg.str(enc); }
  var val = enc.value  !== undefined ? enc.value  : "d",
      off = enc.offset !== undefined ? enc.offset : 0,
      s;
  if (enc.scale !== undefined) {
    var scale = "scales['"+enc.scale+"']";
    // if has scale, run through scale function
    if (enc.band) {
      s = scale + ".rangeBand()";
    } else {
      var d = enc.field !== undefined ? "d['"+enc.field+"']" : val;
      s = scale+"("+d+")";
    }
  } else if (enc.field !== undefined) {
    s = "d['"+enc.field+"']";
  } else if (enc.value !== undefined) {
    s = vg.str(val); // if has value, set directly
  } else {
    s = "d";
  }
  return s + (off ? " + "+off : ""); 
};

vg.varname = function(typestr, index) {
  return typestr + "_" + index;
};

vg.get = function(enc, func) {
  var cnst = vg.isArray(enc) || !vg.isObject(enc) || (enc.field===undefined),
      val = vg.value(enc);
  return cnst && !func ? val : "function(d,i) { return "+val+"; }";
};

vg.getv = function(obj, name) {
  return "function(d,i) { return "+obj+(name ? "."+name : "")+"; }";
};

vg.from = function(from, resolve) {
  resolve = (resolve === undefined ? true : resolve);
  function wrap(d) { return "data['"+d+"']"; }
  function f(d) {
    d = d.split(".");
    return wrap(d[0]) + (d.length>1 && resolve
      ? "."+d.slice(1).join(".") : "");
  }
  var s = "";
  if (vg.isArray(from)) {
    s = "[";
    from.forEach(function(d, i) {
      s += (i>0 ? ", " : "") + f(d);
    });
    s += "]";    
  } else {
    s = f(from);
  }
  return s;
};vg.code = function() {
  var x = {},
      src = [],
      chain = [],
      indent = "",
      step = false,
      cache = true,
      debug = true;

  function _indent(count) {
    count = count || 1;
    while (--count >= 0) indent += "  ";
  }
  
  function _unindent(count) {
    count = count || 1;
    indent = indent.slice(0, indent.length-(2*count));
  }

  function check_step() {
    if (step) {
      _indent();
      step = false;
    }
  }
  
  function is_chain() {
    return chain.length && chain[chain.length-1] >= 0;
  }
  
  x.source = function() {
    return src.join("");
  };

  x.chain = function() {
    chain.push(src.length);
    step = true;
    return x;
  };
  
  x.unchain = function(parens, nosemi) {
    parens = vg.repeat(")", parens || 0);
    var len = src.length;
    if (len && chain.length && chain[chain.length-1] >= 0) {
      src[len-1] = src[len-1].slice(0,-1) + parens + (nosemi?"":";") + "\n";
    }
    chain.pop();
    check_step();
    _unindent();
    return x;
  };
  
  x.decl = function(name, expr) {
    src.push(indent+"var "+name+" = "+expr
      + (is_chain() ? "" : ";") + "\n");
    check_step();
    return x;
  };

  x.setv = function(obj, name, expr) {
    if (arguments.length == 2) {
      expr = name;
      name = obj;
      src.push(indent+name+" = "+expr+";\n");
    } else {
      src.push(indent+obj+"['"+name+"'] = "+expr+";\n");      
    }
    check_step();
    return x;
  };
  
  x.push = function(expr) {
    expr = expr || "";
    src.push(!expr ? "\n" : indent+expr+"\n");
    check_step();
    return x;
  };

  x.call = function(expr) {
    var args = Array.prototype.slice.call(arguments, 1)
      .map(function(x) { return vg.isArray(x) ? "["+x+"]" : x; });
    src.push(indent + expr + "(" + args.join(", ") + ")"
      + (is_chain() ? "" : ";") + "\n");
    check_step();
    return x;
  };

  x.attr = function(obj, name, value) {
    if (arguments.length == 2) {
      value = name;
      name = obj;
      obj = "sel";
    }
    src.push(indent +
      obj + ".attr('" + name + "', " + value + ");\n");
    check_step();
    return x;
  };

  x.indent = function(count) {
    chain.push(-1);
    _indent(count);
    return x;
  };
  
  x.unindent = function(count) {
    chain.pop();
    _unindent(count);
    return x;
  };
  
  x.append = function(s) {
    src.push(s);
    return x;
  };
  
  x.tab = function() {
    return indent;
  };
  
  x.compile = function() {
    var src = "return " + x.source() + ";",
        f = vg_code_cache[src];
    if (f === undefined) {
      if (debug) vg.log(src);
      f = (new Function(src))();
    }
    if (cache) vg_code_cache[src] = f;
    return f;
  };
  
  x.clear = function() {
    src = [];
    chain = [];
    step = false;
    indent = "";
    return x;
  };
  
  return x;
}

var vg_code_cache = {};
vg.template = function(source) {
  var x = {
    source: source,
    text: source
  };

  function stringify(str) {
    return str==undefined ? ""
      : vg.isString(str) ? str : JSON.stringify(str);
  }

  x.set = function(name, content) {
    var regexp = new RegExp("\{\{"+name+"\}\}", "g");
    content = stringify(content);
    x.text = x.text.replace(regexp, content);
  };

  x.toString = function() {
    return x.text;
  };

  return x;
};
vg.spec = {
  "@": {
    "title": "Visualization",
    "description": "A visualization is the top-level object in Vega, and is the container for all visual elements. A visualization consists of a rectangular canvas (the space in which the visual elements reside) and a viewport (a window on to that canvas). In most cases the two are the same size; if the viewport is smaller then the region should be scrollable.\n\nWithin the visualization is a sub-region called the _data rectangle_. All marks reside within the data rectangle. By default the data rectangle fills up the full canvas. Optional padding adds space between the borders of the canvas and data rectangle into which axes can be placed. Note that the total width and height of a visualization is determined by the data rectangle size and padding values.",
    "version": "0.0.1-alpha",
    "type": "object",
    "properties": {
      "name": {
        "description": "A unique name for the visualization specification.",
        "type": "string",
        "minimum": 0
      },
      "width": {
        "description": "The total width, in pixels, of the data rectangle.",
        "type": "integer",
        "minimum": 0,
        "default": 500
      },
      "height": {
        "description": "The total height, in pixels, of the data rectangle.",
        "type": "integer",
        "minimum": 0,
        "default": 500
      },
      "clientWidth": {
        "description": "The width of the on-screen viewport, in pixels. If necessary, clipping and scrolling will be applied.",
        "type": "integer",
        "minimum": 0
      },
      "clientHeight": {
        "description": "The height of the on-screen viewport, in pixels. If necessary, clipping and scrolling will be applied.",
        "type": "integer",
        "minimum": 0
      },
      "padding": [
        {
          "description": "The internal padding, in pixels, from the edge of the visualization canvas to the data rectangle. If an object is provided, it must include {top, left, right, bottom} properties.",
          "type": "integer",
          "minimum": 0,
        },
        {
          "type": "object",
          "properties": {
            "top": {"type": "integer", "minimum": 0},
            "bottom": {"type": "integer", "minimum": 0},
            "left": {"type": "integer", "minimum": 0},
            "right": {"type": "integer", "minimum": 0}
          }
        }
      ],
      "duration": {
        "description": "The default transition duration, in milliseconds. This value may be overridden by mark-specific transition parameters.",
        "type": "integer",
        "minimum": 0
      },
      "data": {
        "description": "An array of data set definitions.",
        "type": "array",
        "items": "@data"
      },
      "scales": {
        "description": "An array of scale transform definitions.",
        "type": "array",
        "items": "@scale"
      },
      "axes": {
        "description": "An array of axis definitions.",
        "type": "array",
        "items": "@axis"
      },
      "encoders": {
        "description": "An array of visual encoder definitions.",
        "type": "array",
        "items": "@encoder"
      },
      "marks": {
        "description": "An array of visual mark definitions.",
        "type": "array",
        "items": "@mark"
      }
    }
  },

  "@data": {
    "title": "Data",
    "description": "Data is assumed to be represented in a tabular format, with data attributes accessible by name or (optionally) by integer index. The specific data formats supported may vary by runtime. In JavaScript, at minimum per-tuple JSON objects (name-value pairs) should be supported. Data bindings can be lazy (with data provided at chart instantiation time), or specified in advance (either through including the data inline or providing a URL from which to load the data).",
    "type": "object",
    "constraints": [{
      "type": "oneOrZero", // TODO: name this constraint
      "properties": ["values", "source", "url"]
    }],
    "properties": {
      "name": {
        "description": "The unique name of the data set.",
        "type": "string",
        "set": "$data",
        "unique": true
      },
      "type": {
        "description": "The type of data structure. One of `table` (default), `group` (a collection of tables) or `tree` (e.g., as the result of a tree transform).",
        "type": "string",
        "values": ["table", "group", "tree"]
      },
      "format": {
        "description": "The data format specifier, such as JSON. The currently supported formats are `json` and `json-col`.",
        "type": "string",
        "values": ["json", "json-row", "json-col"]
      },
      "values": {
        "description": "The actual data set to use. The _values_ property allows data to be inlined directly within the specification itself.",
        "type": "object"
      },
      "source": {
        "description": "The name of another data set to use as the source for this data set. The _source_ property is particularly useful in combination with a transform pipeline to derive new data.",
        "type": "string"
      },
      "url": {
        "description": "A URL from which to load the data set. Use the _type_ property to ensure the loaded data is correctly parsed. If the _type_ property is not specified, the data is assumed to be in a row-oriented JSON format.",
        "type": "string"
      },
      "transform": {
        "description": "An array of transforms to perform on the data. Transform operators will be run on the default data, as provided by late-binding or as specified the _source_, _values_, or _url_ properties.",
        "type": "array",
        "items": "@transform"
      }
    }
  },

  "@transform": {
    "title": "Data Transforms",
    "description": "A data transform performs operations on a data set prior to visualization. Common examples include filtering and grouping (e.g., group data points with the same stock ticker for plotting as separate lines).",
    "type": "object",
    "extend": {
      "by": "type",
      "properties": "@transforms"
    },
    "properties": {
      "type": {
        "description": "The type of transform to apply.",
        "type": "string",
        "values": "@transforms"
      }
    }
  },
  "@transforms": {
    "flatten": {
      "description": "The flatten transform takes a set of arrays and collapses them into a single array."
    },
    "sort": {
      "description": "The sort transform sorts data elements based on their values.",
      "properties": {
        "sort": {
          "description": "The fields by which to sort data. Field names may be prefixed by `+` or `-` to explicitly indicate ascending or descending sort, respectively. If no prefix is added, ascending order is assumed.",
          "type": "array",
          "items": {"type": "String"}
        }
      }
    },
    "rank": {
      "description": "The rank transform numbers each element within a group based on their sort order",
      "properties": {
        "sort": {
          "description": "The fields by which to sort data. If unspecificied, no sorting is performed. Field names may be prefixed by `+` or `-` to explicitly indicate ascending or descending sort, respectively. If no prefix is added, ascending order is assumed.",
          "type": "array",
          "items": {"type": "String"}
        },
        "field": {
          "description": "The name of the field in which to store the rank indices (defaults to `index`).",
          "type": "string",
          "default": "index"
        }
      }
    },
    "group": {
      "description": "The group transform takes a flat collection of data points and groups them into a set of collections based on the values of provided _key_ fields.",
      "properties": {
        "keys": {
          "description": "The fields by which to group the data.",
          "type": "array",
          "items": {"type": "String"}
        },
        "sort": {
          "description": "The fields by which to sort data within each collection. Field names may be prefixed by `+` or `-` to explicitly indicate ascending or descending sort, respectively. If no prefix is added, ascending order is assumed.",
          "type": "array",
          "items": {"type": "String"}
        },
        "rank": [
          {
            "description": "If not false, the group transform will additionally rank number elements in each group. If the provided value is a string, it will be used as the field name for storing the rank indices.",
            "type": "boolean",
            "default": false
          },
          {"type": "string"}
        ]
      }
    },
    "tree": {
      "description": "The tree transform takes a flat collection of data points and groups them into a tree structure according to the provided _key_ fields.",
      "properties": {
        "keys": {
          "description": "The fields by which to group the data. The order of the keys determines the branching criteria for each level of the tree.",
          "type": "array",
          "items": {"type": "String"}
        }
      }
    },
    "count": {
      "description": "The count transform counts the number of elements in each group, as determined by the given _key_ fields.",
      "properties": {
        "keys": {
          "description": "The fields by which to group the data.",
          "type": "array",
          "items": {"type": "String"}
        }
      }
    },
    "sum": {
      "description": "The sum transform computes the sum of a given _value_ field, grouped by the given _key_ fields.",
      "properties": {
        "keys": {
          "description": "The fields by which to group the data; values within each group are summed.",
          "type": "array",
          "items": {"type": "String"}
        },
        "value": {
          "description": "The field containing the numbers to sum.",
          "type": "string"
        }
      }
    },
    "average": {
      "description": "The average transform computes the averages for a given _value_ field, grouped by the given _key_ fields.",
      "properties": {
        "keys": {
          "type": "array",
          "items": {"type": "String"}
        },
        "value": {
          "description": "The field containing the numbers to average.",
          "type": "string"
        }
      }
    },
    "median": {
      "description": "The median transform computes the median for a given _value_ field, grouped by the given _key_ fields.",
      "properties": {
        "keys": {
          "type": "array",
          "items": {"type": "String"}
        },
        "value": {
          "description": "The field containing the values for which to find the median.",
          "type": "string"
        }
      }
    }
  },

  "@scale": {
    "title": "Scales",
    "description": "Scales are functions that transform a _domain_ of data values (numbers, dates, strings, etc) to a _range_ of visual values (pixels, colors, sizes). A scale function takes a single data value as input and returns a visual value. Vega includes different types of scales for quantitative data or ordinal/categorical data.",
    "type": "object",
    "constraints": [
      {
        "type": "if",
        "test": {"type":"eq", "property":"type", "value":"ordinal"},
        "then": [{
          "type": "exclude",
          "properties": ["clamp", "exponent", "nice", "zero"]
        }],
        "else": [{
          "type": "schema",
          "properties": {"domain": {"type": "array", "length": 2}}
        }]
      },
      {
        "type": "if",
        "test": {"type":"neq", "property":"type", "value":"pow"},
        "then": [{
          "type": "exclude",
          "properties": ["exponent"]
        }]
      }
    ],
    "properties": {
      "name": {
        "description": "A unique name for the scale.",
        "type": "string",
        "set": "$scales"
      },
      "type": {
        "description": "The type of scale. For ordinal scales, the value should be `ordinal`. The supported quantitative scale types  are `linear`, `log`, `pow`, `sqrt`, `quantile`, `quantize`, and `threshold`.",
        "type": "string",
        "values": [
          "ordinal",
          "linear",
          "log",
          "pow",
          "sqrt",
          "quantile",
          "quantize",
          "threshold"
        ],
        "default": "linear"
      },
      "domain": [
        {
          "description": "The domain of the scale, representing the set of data values. For quantitative data, this can take the form of a two-element array with minimum and maximum values. For ordinal/categorical data, this may be an array of valid input values. The domain may also be specified by a reference to a data source.",
          "type": "array",
          "items": {"type": "*"}
        },
        {"type": "%dataRef"}
      ],
      "domainMin": {
        "description": "For quantitative scales only, sets the minimum value in the scale domain. domainMin can be used to override, or (with domainMax) used in lieu of, the domain property.",
        "type": "number"
      },
      "domainMax": {
        "description": "For quantitative scales only, sets the maximum value in the scale domain. domainMax can be used to override, or (with domainMin) used in lieu of, the domain property.",
        "type": "number"
      },
      "range": [
        {
          "description": "The range of the scale, representing the set of visual values. For numeric values, the range can take the form of a two-element array with minimum and maximum values. For ordinal data, the range may by an array of desired output values, which are mapped 1-to-1 to elements in the specified domain. The string literals `width` and `height` automatically map to the ranges `[0,width]` or `[0,height]`, as defined by the data rectangle.",
          "type": "array",
          "items": {"type": "*"}
        },
        {
          "type": "string",
          "values":["width", "height"]
        }
      ],
      "rangeMin": {
        "description": "Sets the minimum value in the scale range. rangeMin can be used to override, or (with rangeMax) used in lieu of, the range property.",
        "type": "*"
      },
      "rangeMax": {
        "description": "Sets the maximum value in the scale range. rangeMax can be used to override, or (with rangeMin) used in lieu of, the range property.",
        "type": "*"
      },
      "reverse": {
        "description": "If true, flips the scale range.",
        "type": "boolean"
      },
      "round": {
        "description": "If true, rounds numeric output values to integers. This can be helpful for snapping to the pixel grid.",
        "type": "boolean"
      },
      "clamp": {
        "description": "If true, values that exceed the data domain are clamped to either the minimum or maximum range value.",
        "type": "boolean"
      },
      "exponent": {
        "description": "Sets the exponent of the scale transformation. For `pow` scale types only, otherwise ignored.",
        "type": "number"
      },
      "nice": {
        "description": "If true, modifies the scale domain to use more human-friendly numbers for the range (e.g., 7 instead of 6.96).",
        "type": "boolean"
      },
      "zero": {
        "description": "If true, ensures that a zero baseline value is included in the scale domain. This option is ignored for non-quantitative scales.",
        "type": "boolean"
      }
    }
  },

  "@axis": {
    "title": "Axes",
    "description": "Axes provide gridlines, ticks and labels that convey how a spatial range represents a data range. Simply put, axes visualize scales. Vega currently supports axes for Cartesian (rectangular) coordinates. Future versions may introduce support for polar (circular) coordinates. Axes provide three types of tick marks: major, minor and end ticks. End ticks appear at the edges of the scales.",
    "type": "object",
    "properties": {
      "scale": {
        "description": "The name of the scale backing the axis component.",
        "type": "string",
        "values": "$scales"
      },
      "axis": {
        "description": "The type of axis. One of `x` or `y`.",
        "type": "string",
        "values": ["x", "y"]
      },
      "orient": {
        "description": "The orientation of the axis. One of `top`, `bottom`, `left` or `right`. The orientation can be used to further specialize the axis type (e.g., a `y` axis oriented for the `right` edge of the chart).",
        "type": "string",
        "values": ["top", "bottom", "left", "right"]
      },
      "format": {
        "description": "The formatting pattern for axis labels. Vega uses [D3's format pattern](https://github.com/mbostock/d3/wiki/Formatting).",
        "type": "string"
      },
      "values": {
        "description": "Explicitly set the visible axis tick values.",
        "type": "array"
      },
      "subdivide": {
        "description": "If provided, sets the number of minor ticks between major ticks (the value 9 results in decimal subdivision).",
        "type": "number"
      },
      "tickPadding": {
        "description": "The padding, in pixels, between ticks and text labels.",
        "type": "number",
      },
      "tickSize": {
        "description": "The size, in pixels, of major, minor and end ticks.",
        "type": "number"
      },
      "tickSizeMajor": {
        "description": "The size, in pixels, of major ticks.",
        "type": "number"
      },
      "tickSizeMinor": {
        "description": "The size, in pixels, of minor ticks.",
        "type": "number"
      },
      "tickSizeEnd": {
        "description": "The size, in pixels, of end ticks.",
        "type": "number"
      },
      "offset": {
        "description": "The offset, in pixels, by which to displace the axis from the edge of the data rectangle.",
        "type": "number"
      }
    }
  },

  "@encoder": {
    "title": "Encoders",
    "description": "Encoders are plug-ins that compute visual properties from data. Unlike scales, encoders may map one or more input values to one or more visual output values. Encoders are used to provide more sophisticated encoding algorithms, such as layouts. Given an input data set, encoders compute visual _output_ values for each element.\n\nEach individual encoder type is parameterized by a customized set of _properties_.",
    "type": "object",
    "extend": {
      "title": "Encoder Types",
      "by": "type",
      "properties": "@encoders"
    },
    "properties": {
      "name": {
        "description": "A unique name with which to refer to the encoder.",
        "type": "string",
        "set": "$encoders"
      },
      "type": {
        "description": "The name of the encoder to use. As encoders are intended as plug-ins, the available encoders may vary across Vega instances.",
        "type": "string",
        "values": "@encoders"
      }
    }
  },
  "@encoders": {
    "geo{.*}": {
      "title": "geo",
      "description": "Performs a cartographic projection. Given longitude and latitude values, sets corresponding x and y properties for a mark. Invoking the encoder with type `geo` will default to a Mercator projection. For other projections, use the type string `geo.type` where `type` is any projection supported by the D3 projection plug-in (for example, `geo.albers`, `geo.hammer`, or `geo.winkel3`).",
      "type": "object",
      "properties": {
        "name": {
          "type": "string",
          "set": "$geoProjections"
        },
        "lon": {
          "description": "The input longitude values.",
          "type": "%valueRef",
          "result": "number"
        },
        "lat": {
          "description": "The input latitude values.",
          "type": "%valueRef",
          "result": "number"
        },
        "center": {
          "description": "The center of the projection. The value should be a two-element array of numbers.",
          "type": "array",
          "length": 2,
          "items": {"type": "number"}
        },
        "translate": {
          "description": "The translation of the project. The value should be a two-element array of numbers.",
          "type": "array",
          "length": 2,
          "items": {"type": "number"}
        },
        "scale": {
          "description": "The scale of the projection.",
          "type": "number"
        },
        "rotate": {
          "description": "The rotation of the projection.",
          "type": "number"
        },
        "precision": {
          "description": "The desired precision of the projection.",
          "type": "number"
        },
        "clipAngle": {
          "description": "The clip angle of the projection.",
          "type": "number"
        }
      },
      "output": {
        "x": {"type": "number"},
        "y": {"type": "number"}
      }
    },
    "geojson": {
      "title": "geojson",
      "description": "Creates paths for geographic regions, such as countries, states and counties. Given a GeoJSON Feature data value, produces a corresponding path definition, subject to a specified cartographic projection. The __geojson__ encoder is intended for use with the __path__ mark type.",
      "type": "object",
      "properties": {
        "field": {
          "description": "The GeoJSON Feature data.",
          "type": "%valueRef",
          "result": "object"
        },
        "proj": {
          "description": "The name of the projection to use. The projection name must correspond to a defined __geo__ encoder definition.",
          "type": "string",
          "values": "$geoProjections"
        }
      },
      "output": {
        "path": {"type": "string"}
      }
    },
    "pie": {
      "title": "pie",
      "description": "Computes a pie chart layout. Given a set of data values, sets startAngle and endAngle properties for a mark. The __pie__ encoder is intended for use with the __arc__ mark type.",
      "type": "object",
      "properties": {
        "field": {
          "description": "The data values to encode as arc widths.",
          "type": "%valueRef",
          "result": "number"
        }
      },
      "output": {
        "startAngle": {"type": "number"},
        "endAngle": {"type": "number"}
      }
    },
    "stack": {
      "title": "stack",
      "description": "Computes layout values for stacked graphs, as in stacked bar charts or stream graphs.",
      "type": "object",
      "properties": {
        "x": {
          "description": "The x-values determining which elements are stacked together.",
          "type": "%valueRef",
          "result": "*"
        },
        "y": {
          "description": "The y-values determining stack heights.",
          "type": "%valueRef",
          "result": "number"
        },
        "offset": {
          "description": "The baseline offset style. One of `zero` (default), `silhouette`, `wiggle`, or `expand`.",
          "type": "string",
          "values": ["zero", "silhoutte", "wiggle", "expand"]
        },
        "order": {
          "description": "The sort order for each stack layer. One of `default` (default), `reverse`, or `inside-out`.",
          "type": "string",
          "values": ["default", "reverse", "inside-out"]
        }
      },
      "output": {
        "y": {"type": "number"},
        "height": {"type": "number"}
      }
    },
    "symbol": {
      "title": "symbol",
      "description": "Produces path definitions for plotting symbols. Given a symbol name, returns a path for the corresponding plotting shape. The __symbol__ encoder is intended for use with the __path__ mark type.",
      "type": "object",
      "properties": {
        "shape": {
          "description": "The plotting symbol type. Resulting strings should be one of `circle`, `square`, `cross`, `diamond`, `triangle-up`, or `triangle-down`.",
          "type": "%valueRef",
          "result": "string",
          "values": [
            "circle",
            "square",
            "cross",
            "diamond",
            "triangle-up",
            "triangle-down"
          ]
        },
        "size": {
          "description": "The plotting symbol size. Resulting numbers determine the _area_ of the symbol.",
          "type": "%valueRef",
          "result": "number"
        }
      },
      "output": {
        "path": {"type": "string"}
      }
    },
    "treemap": {
      "title": "treemap",
      "description": "Computes a treemap layout. The __treemap__ encoder is primarily intended for use with the __rect__ mark type.",
      "type": "object",
      "properties": {
        "value": {
          "description": "The values to use to determine the area of each leaf-level treemap cell.",
          "type": "%valueRef",
          "result": "number"
        },
        "sticky": {
          "description": "If true, repeated runs of the treemap will use cached partition boundaries. This results in smoother transition animations, at the cost of unoptimized aspect ratios. If _sticky_ is used, _do not_ reuse the same treemap encoder instance across data sets.",
          "type": "boolean"
        },
        "size": {
          "description": "The dimensions [width, height] of the treemap layout. Defaults to the width and height of the data rectangle.",
          "type": "array",
          "length": 2,
          "items": {"type": "integer"}
        },
        "round": {
          "description": "If true, treemap cell dimensions will be rounded to integer pixels.",
          "type": "boolean"
        },
        "ratio": {
          "description": "The target aspect ratio for the layout to optimize. The default value is the golden ratio, (1 + sqrt(5))/2 =~ 1.618.",
          "type": "number"
        },
        "padding": [
          {
            "description": "The padding (in pixels) to provide around internal nodes in the treemap. For example, this might be used to create space to label the internal nodes. The padding value can either be a single number or an array of four numbers [top, right, bottom, left]. The default padding is zero pixels.",
            "type": "array",
            "length": 4,
            "items": {
              "type": "number",
              "minimum": 0
            }
          },
          {
            "type": "number",
            "minimum": 0
          }
        ]
      },
      "output": {
        "x": {"type": "number"},
        "y": {"type": "number"},
        "width": {"type": "number"},
        "height": {"type": "number"}
      }
    }
  },

  "@mark": {
    "title": "Marks",
    "description": "Marks are the basic visual building block of a visualization. Similar to other mark-based frameworks such as [Protovis](http://protovis.org), marks provide basic shapes whose properties can be set according to backing data. Mark properties can be simple constants, or Scales and Encoders can be used to map from data to property values. The basic supported mark types are rectangles (`rect`), general paths or polygons (`path`), circular arcs (`arc`), filled areas (`area`), lines (`line`), images (`image`) and text labels (`text`).\n\nEach mark supports a set of visual _properties_ which determine the position and appearance of mark instances. Typically one mark instance is generated per input data element; the exceptions are the `line` and `area` mark types, which represent multiple data elements as a contiguous line or area shape. There are three primary property sets: _enter_, _exit_ and _update_. _Enter_ properties are evaluated when data is processed for the first time and a mark instance is newly added to a scene. Similarly, _exit_ properties are evaluated when the data backing a mark is removed, and so the mark is leaving the visual scene. Finally, _update_ properties are evaluated for all existing mark instances.\n\nMark evaluation for a property set proceeds as follows. Given a backing data set, first all encoders are run to populate initial visual properties. Next, all explicit property definitions are evaluated, potentially overwriting the output of the encoders. Finally, the mark is rendered using the resulting visual property values.\n\n_Encoder Invocation_. Encoder invocations for a mark must at minimum include the name of the encoder. Additional encoder parameters (e.g., data fields) can also be specified here, rather than the initial encoder definition. Mark-level encoder parameters take precedence over definition-level parameters.\n\n_Mark Properties_. All visual mark property definitions are specified as name-value pairs in the `update`, `enter` or `exit` object. The name is simply the name of the visual property. The value should be a _ValueRef_. The next section describes the available mark properties in greater detail. The transition parameters _duration_, _delay_ and _ease_ can also be set on an `update` or `exit` object to specify more nuanced behaviors (i.e., to use different animation styles for updating and exiting marks).",
    "type": "object",
    "properties": {
      "name": {
        "description": "A unique name for the mark instance (optional).",
        "type": "string"
      },
      "type": {
        "description": "The mark type (`rect`, `path`, `arc`, etc).",
        "type": "string",
        "values": "@marks"
      },
      "from": [
        {
          "description": "The name of the data set this mark should visualize. If array-valued, specifies a collection of data sets (e.g., each line in a multi-series line chart), one for each array entry. Data references may also include a dot (.) notation for supporting data structures. For example, the `tree` data type provides both `tree.nodes` and `tree.leaves` data tables.",
          "type": "string"
        },
        {
          "type": "array",
          "minimum-length": 1,
          "items": {"type":"string"}
        }
      ],
      "encoders": {
        "description": "An array of encoders to apply for the mark.",
        "type": "array",
        "items": "@markEncoder"
      },
      "update": {
        "description": "Visual property definitions for updating marks.",
        "type": "object",
        "properties": "@markProperties"
      },
      "enter": {
        "description": "Visual property definitions for entering marks.",
        "type": "object",
        "properties": "@markProperties"
      },
      "exit": {
        "description": "Visual property definitions for exiting marks.",
        "type": "object",
        "properties": "@markProperties"
      },
      "duration": {
        "description": "The transition duration, in milliseconds, for mark updates.",
        "type": "number"
      },
      "delay": {
        "description": "The transition delay, in milliseconds, for mark updates. The delay can be set in conjunction with the backing data (possibly through a scale transform) to provide staggered animations.",
        "type": "%valueRef",
        "result": "number"
      },
      "ease": {
        "description": "The transition easing function for mark updates. The supported easing types are `linear`, `quad`, `cubic`, `sin`, `exp`, `circle`, and `bounce`, plus the modifiers `in`, `out`, `in-out`, and `out-in`. The default is `cubic-in-out`. For more details please see the [D3 ease function documentation](https://github.com/mbostock/d3/wiki/Transitions#wiki-d3_ease).",
        "type": "string",
        "values": "#ease"
      }
    }
  },

  "@markEncoder": {
    "type": "object",
    "properties": {
      "name": {
        "type": "string",
        "values": "$encoders"
      }
    }
  },

  "@markProperties": {
    "title": "Visual Mark Properties",
    "description": "For marks involving Cartesian extents (e.g., __rect__ marks), the horizontal dimensions are determined by (in order of precedence) the _x1_ and _x2_ properties, the _x1_ and _width_ properties, and the _x2_ and _width_ properties. If all three of _x1_, _x2_ and _width_ are specified, the _width_ value is ignored. The _y1_, _y2_ and _height_ properties are treated similarly. For marks without Cartesian extents (e.g., __path__, __arc__, etc) the same calculations are applied, but are only used to determine the mark's ultimate _x_ and _y_ position.",
    "type": "object",
    "extend": {
      "by": "type",
      "properties": "@marks"
    },
    "properties": {
      "x1": {
        "description": "The first (typically left-most) x-coordinate.",
        "type": "%valueRef",
        "result": "number"
      },
      "x2": {
        "description": "The second (typically right-most) x-coordinate.",
        "type": "%valueRef",
        "result": "number"
      },
      "y1": {
        "description": "The first (typically top-most) y-coordinate.",
        "type": "%valueRef",
        "result": "number"
      },
      "y2": {
        "description": "The second (typically bottom-most) y-coordinate.",
        "type": "%valueRef",
        "result": "number"
      },
      "width": {
        "description": "The width of the mark (if supported).",
        "type": "%valueRef",
        "result": "number"
      },
      "height": {
        "description": "The height of the mark (if supported).",
        "type": "%valueRef",
        "result": "number"
      },
      "opacity": {
        "description": "The mark opacity. A number between 0 (transparent) and 1 (opaque).",
        "type": "%valueRef",
        "result": "number"
      },
      "fill": {
        "description": "The fill color.",
        "type": "%valueRef",
        "result": "string"
      },
      "fillOpacity": {
        "description": "The fill opacity. A number between 0 (transparent) and 1 (opaque).",
        "type": "%valueRef",
        "result": "number"
      },
      "stroke": {
        "description": "The stroke color.",
        "type": "%valueRef",
        "result": "string"
      },
      "strokeWidth": {
        "description": "The stroke width, in pixels.",
        "type": "%valueRef",
        "result": "number"
      },
      "strokeOpacity": {
        "description": "The stroke opacity. A number between 0 (transparent) and 1 (opaque).",
        "type": "%valueRef",
        "result": "number"
      },
      "delay": {
        "description": "The transition delay, in milliseconds.",
        "type": "%valueRef",
        "result": "number"
      },
      "duration": {
        "description": "The transition duration, in milliseconds.",
        "type": "number"
      },
      "ease": {
        "description": "The transition easing function.",
        "type": "string",
        "values": "#ease"
      }
    }
  },
  "@marks": {
    "rect": {
      "description": "(No additional properties)."
    },
    "circ": {
      "properties": {
        "size": {
          "description": "The size of the circle. The square root of the size value is used to determine the circle radius.",
          "type": "%valueRef",
          "result": "number"
        }
      }
    },
    "path": {
      "properties": {
        "path": {
          "description": "A path definition in the form of an SVG Path string.",
          "type": "%valueRef",
          "result": "string"
        }
      }
    },
    "arc": {
      "properties": {
        "innerRadius": {
          "description": "The inner radius of the arc, in pixels.",
          "type": "%valueRef",
          "result": "number"
        },
        "outerRadius": {
          "description": "The outer radius of the arc, in pixels.",
          "type": "%valueRef",
          "result": "number"
        },
        "startAngle": {
          "description": "The start angle of the arc, in radians.",
          "type": "%valueRef",
          "result": "number"
        },
        "endAngle": {
          "description": "The end angle of the arc, in radians.",
          "type": "%valueRef",
          "result": "number"
        }
      }
    },
    "area": {
      "properties": {
        "interpolate": {
          "description": "The line interpolation method to use. One of `linear`, `step-before`, `step-after`, `basis`, `basis-open`, `cardinal`, `cardinal-open`, `monotone`.",
          "type": "%valueRef",
          "result": "string",
          "values": [
            "linear",
            "step-before",
            "step-after",
            "basis",
            "basis-open",
            "cardinal",
            "cardinal-open",
            "monotone"
          ]
        },
        "tension": {
          "description": "Depending on the interpolation type, sets the tension parameter.",
          "type": "%valueRef",
          "result": "number"
        }
      }
    },
    "line": {
      "properties": {
        "interpolate": {
          "description": "The line interpolation method to use. One of `linear`, `step-before`, `step-after`, `basis`, `basis-open`, `basis-closed`, `bundle`, `cardinal`, `cardinal-open`, `cardinal-closed`, `monotone`.",
          "type": "%valueRef",
          "result": "string",
          "values": [
            "linear",
            "step-before",
            "step-after",
            "basis",
            "basis-open",
            "basis-closed",
            "bundle",
            "cardinal",
            "cardinal-open",
            "cardinal-closed",
            "monotone"
          ]
        },
        "tension": {
          "description": "Depending on the interpolation type, sets the tension parameter.",
          "type": "%valueRef",
          "result": "number"
        }
      }
    },
    "image": {
      "properties": {
        "url": {
          "description": "The URL from which to retrieve the image.",
          "type": "%valueRef",
          "result": "url"
        },
        "ratio": {
          "description": "If true (the default), scaling preserves the image aspect ratio.",
          "type": "%valueRef",
          "result": "number"
        },
        "align": {
          "description": "The horizontal alignment of the text. One of `left`, `right`, `center`.",
          "type": "%valueRef",
          "result": "string",
          "values": ["left", "right", "center"]
        },
        "baseline": {
          "description": "The vertical alignment of the text. One of `top`, `middle`, `bottom`.",
          "type": "%valueRef",
          "result": "string",
          "values": ["top", "bottom", "middle"]
        }
      }
    },
    "text": {
      "properties": {
        "text": {
          "description": "The text to display.",
          "type": "%valueRef",
          "result": "string"
        },
        "align": {
          "description": "The horizontal alignment of the text. One of `left`, `right`, or `center`.",
          "type": "%valueRef",
          "result": "string",
          "values": ["left", "right", "center"]
        },
        "baseline": {
          "description": "The vertical alignment of the text. One of `top`, `middle`, or `bottom`.",
          "type": "%valueRef",
          "result": "string",
          "values": ["top", "bottom", "middle"]
        },
        "xMargin": {
          "description": "The horizontal margin, in pixels, between the text label and its anchor point. The value is ignored if the _align_ property is `center`.",
          "type": "%valueRef",
          "result": "number"
        },
        "yMargin": {
          "description": "The vertical margin, in pixels, between the text label and its anchor point. The value is ignored if the _baseline_ property is `middle`.",
          "type": "%valueRef",
          "result": "number"
        },
        "angle": {
          "description": "The rotation angle of the text, in degrees.",
          "type": "%valueRef",
          "result": "number"
        },
        "font": {
          "description": "A full font definition (e.g., `13px Helvetica Neue`).",
          "type": "%valueRef",
          "result": "string"
        },
        "fontFamily": {
          "description": "The typeface to set the text in.",
          "type": "%valueRef",
          "result": "string"
        },
        "fontSize": {
          "description": "The font size, in pixels.",
          "type": "%valueRef",
          "result": "number"
        },
        "fontWeight": {
          "description": "The font weight (e.g., `bold`).",
          "type": "%valueRef",
          "result": "string"
        },
        "fontStyle": {
          "description": "The font style (e.g., `italic`).",
          "type": "%valueRef",
          "result": "string"
        }
      }
    }
  },

  "%dataRef": {
    "title": "Data Reference",
    "description": "A data reference ( _DataRef_ ) refers to a set of values within a data set. A basic data reference simply refers to a column in a data table. Values from multiple columns can be specified as an array of basic data references.",
    "type": "object",
    "properties": {
      "data": {
        "description": "The name of the data set.",
        "type": "string",
        "required": true
      },
      "field": [
        {
          "description": "The field (column) of data values.",
          "type": "string"
        },
        {"type": "integer"}
      ]
    }
  },

  "%valueRef": [
    {
      "title": "Value Reference",
      "description": "A value reference ( _ValueRef_ ) refers to a specific value. The value may be a constant, a value in a data set, and may include application of scale transform to either.",
      "type": "object",
      "properties": {
        "value": {
          "description": "A constant value. If _field_ is specified, this value is ignored.",
          "type": "*"
        },
        "field": {
          "description": "A field (column) from which to pull a data value. The corresponding data set is determined by the surrounding mark context.",
          "type": "string"
        },
        "scale": {
          "description": "The name of a scale transform to apply.",
          "type": "string",
          "values": "$scales"
        },
        "offset": {
          "description": "A simple additive offset to bias the final value, equivalent to (value + offset). Offsets are added _after_ any scale transformation.",
          "type": "number"
        },
        "band": {
          "description": "If true, and _scale_ is specified, uses the range band of the scale as the retrieved value. This option is useful for determining widths with an ordinal scale.",
          "type": "boolean"
        }
      }
    },
    {
      "type": "$result",
      "values": "$values"
    }
  ],

  "#ease": [
    "linear-in",
    "quad-in",
    "cubic-in",
    "sin-in",
    "exp-in",
    "circle-in",
    "bounce-in",
    "linear-out",
    "quad-out",
    "cubic-out",
    "sin-out",
    "exp-out",
    "circle-out",
    "bounce-out",    
    "linear-in-out",
    "quad-in-out",
    "cubic-in-out",
    "sin-in-out",
    "exp-in-out",
    "circle-in-out",
    "bounce-in-out",
    "linear-out-in",
    "quad-out-in",
    "cubic-out-in",
    "sin-out-in",
    "exp-out-in",
    "circle-out-in",
    "bounce-out-in"
  ]
};vg.docs = function(spec) {
  var text = [];

  vg_docs_node(text, spec, "@");
  vg_docs_node(text, spec, "@data");
  vg_docs_node(text, spec, "@transform");
  vg_docs_node(text, spec, "%dataRef");
  vg_docs_node(text, spec, "%valueRef");
  vg_docs_node(text, spec, "@scale");
  vg_docs_node(text, spec, "@axis");
  vg_docs_node(text, spec, "@mark");
  vg_docs_node(text, spec, "@markProperties");
  vg_docs_node(text, spec, "@encoder");
  
  return text.join("");
};

function vg_docs_node(text, spec, key) {
  var node = vg.isArray(spec[key]) ? spec[key][0] : spec[key],
      str, key, props, prop, type, desc;
  
  if (node.title) {
    str = "## " + vg_docs_title(node.title) + "\n\n";
    text.push(str);
  }
  
  if (node.description) {
    text.push(node.description);
    text.push("\n\n");
  }

  if (vg.isObject(props = node.properties)) {
    text.push("_Properties_\n");
    vg_docs_props(text, props);
  }

  if (node.extend && (props = node.extend.properties)) {
    props = vg.isString(props) ? spec[props] : props;
    
    for (key in props) {
      prop = props[key];
      text.push("### " + vg_docs_title(key) + "\n\n");
      if (prop.description) {
        text.push(prop.description);
        text.push("\n\n");
      }
      if (prop.properties) {
        vg_docs_props(text, prop.properties);
      }
    }
  }
}

function vg_docs_title(title) {
  return title.split('{')[0];
}

function vg_docs_props(text, props) {
  var key, prop, type, desc, str;
  
  for (key in props) {
    prop = props[key];
    type = vg_doc_type(prop);
    desc = (vg.isArray(prop) ? prop[0] : prop).description;
    str = "* __"+key+"__ [" + type + "] " + desc + "\n";
    text.push(str);
  }
  text.push("\n\n");
}

function vg_doc_type(prop) {
  function type(p) {
    var t = p.type, v;
    if (t[0]==="%" || t[0]==="@") t = t.slice(1);
    t = t[0].toUpperCase() + t.slice(1);
    if (t==="ValueRef") t += " -> " + type({"type":p.result});
    if (t==="Array" && p.items) {
      v = vg.isString(p.items) ? p.items : p.items.type;
      t += "<" + type({"type":v}) + ">";
    }
    return t;
  }
  return (vg.isArray(prop) ? prop : [prop]).map(type).join(" | ");
}vg.scales = function(spec, sc) {
  (spec.scales || []).forEach(function(scale, index) {
    if (index > 0) sc.push();
    vg.scale(scale, sc);
  });
};

vg.scale = function(scale, sc) {
  // determine scale type
  var type = scale.type || "linear";
  sc.chain().push("scales['"+scale.name+"'] = d3.scale."+type+"()");
  (type==="ordinal" ? vg.scale.ordinal : vg.scale.quant)(scale, sc);
  sc.unchain();
};

vg.scale.keywords = {
  "width": "width",
  "height": "height"
};

vg.scale.range = function(scale) {
  var rng = [null, null];
  
  if (scale.range !== undefined) {
    if (vg.isString(scale.range)) {
      if (vg.scale.keywords[scale.range]) {
        rng = [0, scale.range]
      } else {
        vg.error("Unrecogized range: "+scale.range);
        return rng;
      }
    } else if (vg.isArray(scale.range)) {
      rng = scale.range;
    } else {
      rng = [0, scale.range];
    }
  }
  if (scale.rangeMin !== undefined) {
    rng[0] = scale.rangeMin;
  }
  if (scale.rangeMax !== undefined) {
    rng[1] = scale.rangeMax;
  }
  return rng;
};vg.scale.ordinal = function(scale, sc) {
  // init domain
  var domain = scale.domain;
  if (vg.isArray(domain)) {
    sc.call(".domain", vg.str(domain));
  } else if (vg.isObject(domain)) {
    var ref = domain,
        dat = "data['"+ref.data+"']",
        get = vg.str(ref.field);
    sc.call(".domain", "vg.unique("+dat+", "+get+")");
  }

  // init range
  var range = vg.scale.range(scale),
      isStr = vg.isString(range[0]);
  if (scale.reverse) range = range.reverse();
  range = "[" + range.map(function(r) {
    return vg.scale.keywords[r] ? r : vg.str(r);
  }).join(", ") + "]";
  if (isStr) { // e.g., color or shape values
    sc.call(".range", range); 
  } else { // spatial values
    sc.call(scale.round ? ".rangeRoundBands" : ".rangeBands",
      range, scale.padding);
  }
};vg.scale.quant = function(scale, sc) {
  // init domain
  var dom = [null, null];
  if (scale.domain !== undefined) {
    if (vg.isArray(scale.domain)) {
      dom = scale.domain.slice();
    } else if (vg.isObject(scale.domain)) {
      var ref = scale.domain,
          dat = "data['"+ref.data+"']",
          get = vg.get({field:ref.field});
      dom[0] = "d3.min("+dat+", "+get+")";
      dom[1] = "d3.max("+dat+", "+get+")";
    } else {
      dom = scale.domain;
    }
  }
  if (scale.domainMin !== undefined) {
    if (vg.isObject(scale.domainMin)) {
      var ref = scale.domainMin,
          dat = "data['"+ref.data+"']",
          get = vg.get({field:ref.field});
      dom[0] = "d3.min("+dat+", "+get+")";
    } else {
      dom[0] = scale.domainMin;
    }
  }
  if (scale.domainMax !== undefined) {
    if (vg.isObject(scale.domainMax)) {
      var ref = scale.domainMax,
          dat = "data['"+ref.data+"']",
          get = vg.get({field:ref.field});
      dom[1] = "d3.max("+dat+", "+get+")";
    } else {
      dom[1] = scale.domainMax;
    }
  }
  if (scale.zero === undefined || scale.zero) { // default true
    dom[0] = "Math.min(0, "+dom[0]+")";
    dom[1] = "Math.max(0, "+dom[1]+")";
  }
  sc.call(".domain", "["+dom.join(", ")+"]");

  // init range
  var range = vg.scale.range(scale);
  // vertical scales should flip by default, so use XOR here
  if ((!!scale.reverse) != ("height"==scale.range)) range = range.reverse();
  range = "[" + range.map(function(r) {
    return vg.scale.keywords[r] ? r : vg.str(r);
  }).join(", ") + "]";
  sc.call(scale.round ? ".rangeRound" : ".range", range);
  
  if (scale.clamp)
    sc.call(".clamp", "true");
  if (scale.nice)
    sc.call(".nice");
  if (scale.type==="pow" && scale.exponent)
    sc.call(".exponent", scale.exponent);  
};vg.axes = function(spec, sc) {
  (spec.axes || []).forEach(function(axis, index) {
    if (index > 0) sc.push();
    vg.axis(axis, index, sc);
  });
};

vg.axis = function(axis, index, sc) {
  var aname = vg.varname("axis", index);
  sc.chain()
    .decl(aname, "d3.svg.axis()");
  
  // axis scale
  if (axis.scale !== undefined) {
    sc.call(".scale", "scales['"+axis.scale+"']");
  }

  // axis orientation
  var orient = axis.orient || vg_axis_orient[axis.axis];
  sc.call(".orient", vg.str(orient));

  // axis values
  if (axis.values !== undefined) {
    sc.call(".tickValues", axis.values);
  }

  // axis label formatting
  if (axis.format !== undefined) {
    sc.call(".tickFormat", "d3.format('"+axis.format+"')");
  }

  // axis tick subdivision
  if (axis.subdivide !== undefined) {
    sc.call(".tickSubdivide", axis.subdivide);
  }
  
  // axis tick padding
  if (axis.tickPadding !== undefined) {
    sc.call(".tickPadding", axis.tickPadding);
  }
  
  // axis tick size(s)
  var size = [];
  if (axis.tickSize !== undefined) {
    for (var i=0; i<3; ++i) size.push(axis.tickSize);
  } else {
    size = [6, 6, 6];
  }
  if (axis.tickSizeMajor !== undefined) size[0] = axis.tickSizeMajor;
  if (axis.tickSizeMinor !== undefined) size[1] = axis.tickSizeMinor;
  if (axis.tickSizeEnd   !== undefined) size[2] = axis.tickSizeEnd;
  if (size.length) {
    sc.call(".tickSize", size.join(","));
  }
  
  // tick arguments
  if (axis.ticks !== undefined) {
    var ticks = vg.isArray(axis.ticks) ? axis.ticks : [axis.ticks];
    sc.call(".ticks", ticks.join(", "));
  }
  sc.unchain();

  // axis offset
  if (axis.offset) {
    sc.push(aname + ".offset = " + axis.offset + ";");
  }
  
  // cache scale name
  sc.push(aname + ".scaleName = '" + axis.scale + "';");

  sc.push("axes.push("+aname+");");
};

var vg_axis_orient = {
  "x":      "bottom",
  "y":      "left",
  "top":    "top",
  "bottom": "bottom",
  "left":   "left",
  "right":  "right"
};vg.axes.update = function(spec, sc) {
  if (!spec.axes || spec.axes.length==0) return;
  sc.push("dur = dur!=undefined ? dur : duration;")
    .push("var init = axes.init; axes.init = true;")
    .decl("sel", "duration && init ? dom.transition(duration) : dom")
    .chain()
    .push("sel.selectAll('g.axis')")
    .push(".attr('transform', function(axis,i) {")
    .indent()
      .push("var offset = axis.offset || 0, xy;")
      .push("switch(axis.orient()) {")
      .indent()
        .push("case 'left':   xy = [     -offset,  0]; break;")
        .push("case 'right':  xy = [width+offset,  0]; break;")
        .push("case 'bottom': xy = [0, height+offset]; break;")
        .push("case 'top':    xy = [0,       -offset]; break;")
        .push("default: xy = [0,0];")
      .unindent()
      .push("}")
      .push("return 'translate('+xy[0]+', '+xy[1]+')';")
    .unindent()
    .push("})")
    .push(".each(function(axis) {")
      .indent()
      .push("axis.scale(scales[axis.scaleName]);")
      .push("var s = d3.select(this);")
      .push("(duration && init")
        .indent()
        .push("? s.transition().duration(duration)")
        .push(": s).call(axis);")
        .unindent()
      .unindent()
    .push("})")
    .unchain();
};vg.data = function(spec, sc) {
  (spec.data || []).forEach(function(dat) {
    vg.datum(dat, sc);
  });
};

vg.data.load = function(spec, sc) {
  var urls = (spec.data || []).filter(function(dat) { return dat.url; });
  if (urls.length == 0) {
    sc.push("callback(vis);")
  } else {
    sc.decl("count", urls.length);
    urls.forEach(function(dat) { vg.datum.load(dat, sc); });
    sc.push("if (!count) callback(vis);");
  }
};

vg.datum = function(dat, sc) {
  if (dat.values) {
    sc.push(vg.from(dat.name) + " = " + JSON.stringify(dat.values) + ";");
  } else if (dat.source) {
    sc.push(vg.from(dat.name) + " = " + vg.from(dat.source) + ";");
  }
  vg.datum.transform(dat, sc);
};

vg.datum.load = function(dat, sc) {
  var fmt = vg.data.format[dat.format || "json"];
  sc.push("d3.xhr(" + vg.str(dat.url) + ", function(err, resp) {")
    .indent()
      .push("if (err) {")
        .indent()
        .push("alert(err);")
        .unindent()
      .push("} else {")
        .indent()
        .push(vg.from(dat.name) + " = " + fmt("resp.response") + ";")
        .unindent()
      .push("}")
      .push("if (!(--count)) callback(vis);")
    .unindent()
    .push("});");
};

vg.datum.transform = function(dat, sc) {
  (dat.transform || []).forEach(function(tx) {
    var t = vg.data.transform.registry[tx.type];
    if (!t) throw new Error ("Unrecognized data transform: "+tx.type);
    t(dat, tx, sc);
  });
};vg.data.format = {};

vg.data.format["json"] = function(d) {
  return "JSON.parse("+d+")";
};

vg.data.format["json-col"] = function(d) {
  return "vg.fromColumns(JSON.parse("+d+"))";
};vg.data.transform = {};
vg.data.transform.registry = {};

vg.data.transform.register = function(type, transform) {
  vg.data.transform.registry[type] = transform;
};

// flatten transform
vg.data.transform.register("flatten", function(dat, tx, sc) {
  var data = vg.from(dat.name);
  sc.push(data + " = vg.flatten(" + data + ");");
});

// group transform
vg.data.transform.register("group", function(dat, tx, sc) {
  var data = vg.from(dat.name);
  sc.push(data + " = vg.group(" + data
    + (tx.keys ? ", ["+tx.keys.map(vg.str).join(", ")+"]" : "")
    + (tx.sort ? ", ["+tx.sort.map(vg.str).join(", ")+"]" : "")
    + (tx.rank ? ", "+vg.str(field) : "")
    + ");");
});

// rank transform
vg.data.transform.register("rank", function(dat, tx, sc) {
  var data = vg.from(dat.name);
  sc.push(data + " = vg.rank(" + data
    + (tx.sort ? ", ["+tx.sort.map(vg.str).join(", ")+"]" : "")
    + (tx.field ? ", "+vg.str(field) : "")
    + ");");
});

// sort transform
vg.data.transform.register("sort", function(dat, tx, sc) {
  var data = vg.from(dat.name);
  sc.push(data + " = vg.sort(" + data
    + (tx.sort ? ", ["+tx.sort.map(vg.str).join(", ")+"]" : "")
    + ");");
});

// tree transform
vg.data.transform.register("tree", function(dat, tx, sc) {
  var data = vg.from(dat.name);
  sc.push(data + " = vg.tree(" + data
    + (tx.keys ? ", ["+tx.keys.map(vg.str).join(", ")+"]" : "")
    + ");");
});

// reductions
vg.data.transform.reduce = function(func) {
  return function(dat, tx, sc) {
    var data = vg.from(dat.name);
    sc.push(data + " = vg.reduce(" + data
      + ", vg.reduce."+func+", " + vg.str(tx.value)
      + (tx.keys ? ", ["+tx.keys.map(vg.str).join(", ")+"]" : "")
      + ");");
  }
};

["sum"].forEach(function(func) {
  var reduction = vg.data.transform.reduce(func);
  vg.data.transform.register(func, reduction);
});vg.marks = function(spec, sc) {
  // build global name map of data sets
  var dmap = {};
  (spec.data || []).forEach(function(dat) {
    dmap[dat.name] = dat;
  });
  // build global name map of encoders
  var emap = {};
  (spec.encoders || []).forEach(function(enc) {
    emap[enc.name] = enc;
  });
  // generate code for marks
  (spec.marks || []).forEach(function(mark, index) {
    if (index > 0) sc.push();
    vg.mark(mark, index, spec, dmap, emap, sc);
  });
};

vg.mark = function(mark, index, spec, dataMap, encoderMap, sc) {
  // check if mark type is supported
  if (vg.mark.registry[mark.type] == undefined) {
    vg.log("Skipping unsupported mark type: "+mark.type);
    return;
  }
  
  // set up encoders, as needed
  var encoders = [];
  (mark.encoders || []).forEach(function(enc, i) {
    var def = encoderMap[enc.name];
    encoders.push({
      def: def,
      spec: vg.extend(vg.clone(def), enc)
    });
  });
  
  // generate mark code
  sc.push("// Mark "+index+" ("+mark.type+")");
  sc.push("marks.push(function(dur) {").indent();
  
  encoders.forEach(function(enc) {
    vg.encoder.start(enc.def, enc.spec, mark, index, sc);
  });
  vg.mark.builder(spec, mark, index, dataMap, encoders, sc);
  encoders.forEach(function(enc) {
    vg.encoder.finish(enc.def, enc.spec, mark, index, sc);
  });
  
  sc.unindent().push("});");
};

vg.mark.obj = "this.vega";
vg.mark.registry = {};
vg.mark.reserved = {
  "x1":       1,
  "x2":       1,
  "y1":       1,
  "y2":       1,
  "width":    1,
  "height":   1,
  "duration": 1,
  "delay":    1,
  "ease":     1
};
vg.mark.styles = {
  "opacity":       "opacity",
  "fill":          "fill",
  "stroke":        "stroke",
  "fillOpacity":   "fill-opacity",
  "strokeOpacity": "stroke-opacity",
  "strokeWidth":   "stroke-width",
  "font":          "font",
  "fontFamily":    "font-family",
  "fontSize":      "font-size",
  "fontWeight":    "font-weight",
  "fontStyle":     "font-style"
};

vg.mark.register = function(type, def) {
  vg.mark.registry[type] = def;
  (def.reserved || []).forEach(function(p) {
    vg.mark.reserved[p] = 1 + (vg.mark.reserved[p] || 0);
  });
};

vg.mark.from = function(mark, datatype) {
  var def = vg.mark.registry[mark.type],
      from = mark.from,
      flat = arguments.length > 1, // don't flatten if no group arg
      s = vg.from(from);
  group = vg.isArray(from) || (datatype === "group");
  if (flat && group && !def.group) {
    s = "vg.flatten("+s+")";
  }
  return s;
};

vg.mark.builder = function(spec, mark, index, data, encoders, sc) {
  var markName = vg.varname(mark.type, index),
      from = vg.isArray(mark.from) ? null : mark.from.split(".")[0],
      dat = vg.mark.from(mark, from===null ? null : data[from].type),
      def = vg.mark.registry[mark.type],
      key = from===null ? undefined : data[from].key,
      keyfn = (key === undefined ? "null"
        : "function(d) { return d["+vg.str(key)+"]; }");

  // select
  sc.chain()
    .decl(markName, "dom.select('.mark-"+index+"')")
    .call(".selectAll", "'"+def.svg+"'")
    .call(".data", dat, keyfn)
    .unchain().push();

  // enter
  sc.push("// enter");
  sc.chain().push(markName+".enter().append('"+def.svg+"')");
  if (mark.enter) {
    vg.mark.encode(mark, mark.enter, index, encoders, sc);
    def.attr(mark.enter, sc);
    vg.mark.props(mark.enter, sc);
  }
  sc.unchain().push();

  // exit
  sc.push("// exit");
  vg.mark.selection(spec, mark, markName, "exit", sc);
  if (mark.exit) {
    vg.mark.encode(mark, mark.exit, index, encoders, sc);
    def.attr(mark.exit, sc);
    vg.mark.props(mark.exit, sc);
  }
  sc.call(".remove").unchain().push();

  // update
  sc.push("// update");
  vg.mark.selection(spec, mark, markName, "update", sc);
  if (mark.update) {
    vg.mark.encode(mark, mark.update, index, encoders, sc);
    def.attr(mark.update, sc);
    vg.mark.props(mark.update, sc);
  }
  sc.unchain();
};

vg.mark.selection = function(spec, mark, markName, selName, sc) {
  var props = mark[selName],
      dur = (props && props.duration) || mark.duration,
      durName = "dur_"+selName;
    
  sc.decl(durName, "dur!=undefined ? dur : " +
    (dur !== undefined ? vg.value(dur) : "duration"));

  selName = selName==="update" ? "" : ("." + selName + "()");
  sc.chain().push("("+durName+" ? " + markName + selName + ".transition()");
  
  var ease = (props && props.ease) || mark.ease || spec.ease;
  if (ease) sc.call(".ease", vg.value(ease));  
  
  var delay = (props && props.delay) || mark.delay || spec.delay;
  if (delay) sc.call(".delay", vg.get(delay));
  
  sc.push(".duration("+durName+")" + " : " + markName + selName + ")");
}

vg.mark.encode = function(mark, props, index, encoders, sc) {
  var obj = vg.mark.obj,
      def = vg.mark.registry[mark.type];

  sc.push(".each(function(d,i) {").indent();
  if (def.group) {
    sc.push("var scene = "+obj+" || ("+obj+" = []);");
    sc.push("d.forEach(function(d,j) {").indent();
    sc.push("var o = scene[j] || (scene[j] = {x:0, y:0});");
  } else {
    sc.push("var o = "+obj+" || ("+obj+" = {x:0, y:0});");
  }
  
  // encoder properties
  encoders.forEach(function(enc) {
    vg.encoder.encode(enc.def, enc.spec, mark, index, sc);
  });

  // horizontal spatial properties
  if (props.x1 !== undefined && props.x2 !== undefined) {
    sc.decl("x1", vg.value(props.x1))
      .decl("x2", vg.value(props.x2))
      .push("if (x1 > x2) { var tmp = x1; x1 = x2; x2 = tmp; }")
      .push("o.x = x1;")
      .push("o.width = (x2-x1);");
  } else if (props.x1 !== undefined && props.width !== undefined) {
    sc.decl("x1", vg.value(props.x1))
      .decl("w", vg.value(props.width))
      .push("if (w < 0) { x1 += w; w *= -1; }")
      .push("o.x = x1;")
      .push("o.width = w;");
  } else if (props.x2 !== undefined && props.width !== undefined) {
    sc.decl("w", vg.value(props.width))
      .decl("x2", vg.value(props.x2) + " - w")
      .push("if (width < 0) { x2 += w; w *= -1; }")
      .push("o.x = x2;")
      .push("o.width = w;");
  } else if (props.x1 !== undefined) {
    sc.push("o.x = " + vg.value(props.x1) + ";");
  }

  // vertical spatial properties
  if (props.y1 !== undefined && props.y2 !== undefined) {
    sc.decl("y1", vg.value(props.y1))
      .decl("y2", vg.value(props.y2))
      .push("if (y1 > y2) { var tmp = y1; y1 = y2; y2 = tmp; }")
      .push("o.y = y1;")
      .push("o.height = (y2-y1);");
  } else if (props.y1 !== undefined && props.height !== undefined) {
    sc.decl("y1", vg.value(props.y1))
      .decl("h", vg.value(props.height))
      .push("if (h < 0) { y1 += h; h *= -1; }")
      .push("o.y = y1;")
      .push("o.height = h;");
  } else if (props.y2 !== undefined && props.height !== undefined) {
    sc.decl("h", vg.value(props.height))
      .decl("y2", vg.value(props.y2) + " - h")
      .push("if (height < 0) { y2 += h; h *= -1; }")
      .push("o.y = y2;")
      .push("o.height = h;");
  } else if (props.y1 !== undefined) {
    sc.push("o.y = " + vg.value(props.y1) + ";");
  }

  // mark-specific properties
  if (def.encode) def.encode(props, sc);

  if (def.group) {
    sc.unindent().push("});");
  }
  sc.unindent().push("})");
};

vg.mark.props = function(properties, sc) {
  for (var name in properties) {
    if (vg.mark.reserved[name]) continue;
    sc.call(vg.mark.styles[name] ? ".style" : ".attr",
      vg.str(vg.mark.styles[name] || name),
      vg.get(properties[name]));
  }
};vg.mark.register("arc", {
  svg: "path",
  reserved: ["innerRadius", "outerRadius", "startAngle", "endAngle"],
  encode: function(properties, sc) {
    ["innerRadius","outerRadius","startAngle","endAngle"].forEach(function(p) {
      if (properties[p] === undefined) return;
      sc.push("o."+p+" = "+vg.value(properties[p])+";");
    });
  },
  attr: function(properties, sc) {
    var o = vg.mark.obj;
    sc.call(".attr", "'transform'", "function() { "
        + "return 'translate('+"+o+".x+','+"+o+".y+')'; }")
      .call(".attr", "'d'", "function() { return d3.svg.arc()("+o+"); }");
  }
});
vg.mark.register("area", {
  svg: "path",
  group: true,
  reserved: ["interpolate", "tension"],
  attr: function(properties, sc) {
    var o = vg.mark.obj + "[i]";
    sc.chain()
      .push(".attr('d', d3.svg.area()")
      .call(".x",  vg.getv(o, "x"))
      .call(".y0", vg.getv(o, "y"))
      .call(".y1", "function(d,i) { return "+o+".y + "+o+".height; }");
    if (properties.interpolate !== undefined)
      sc.call(".interpolate", vg.value(properties.interpolate));
    if (properties.tension !== undefined)
      sc.call(".tension", vg.value(properties.tension));
    sc.unchain(1, true);
  }
});vg.mark.register("circ", {
  svg: "circle",
  reserved: ["size"],
  encode: function(properties, sc) {
    if (properties["size"] !== undefined) {
      sc.push("o.size = Math.sqrt(" + vg.value(properties["size"]) + ");");
    }
  },
  attr: function(properties, sc) {
    var o = vg.mark.obj;
    if (properties.x1 || properties.x2)
      sc.call(".attr", "'cx'", vg.getv(o, "x"));
    if (properties.y1 || properties.y2)
      sc.call(".attr", "'cy'", vg.getv(o, "y"));
    if (properties.size)
      sc.call(".attr", "'r'", vg.getv(o, "size"));
  }
});vg.mark.register("image", {
  svg: "image",
  reserved: ["url", "align", "baseline", "aspect"],
  encode: function(properties, sc) {
    if (properties.align) {
      sc.decl("align", vg.value(properties.align))
        .push("if (align === 'right') o.x = o.x - o.width;")
        .push("if (align === 'center') o.x = o.x - o.width/2;");
    }
    if (properties.baseline) {
      sc.decl("baseline", vg.value(properties.baseline))
        .push("if (baseline === 'bottom') o.y = o.y - o.height;")
        .push("if (baseline === 'middle') o.y = o.y - o.height/2;");
    }
    if (properties.ratio !== undefined) {
      sc.decl("ratio", vg.value(properties.ratio))
        .push("o.ratio = ratio ? 'xMidYMid' : 'none'");
    }
  },
  attr: function(properties, sc) {
    var obj = vg.mark.obj;
    if (properties.ratio !== undefined)
      sc.call(".attr", "'preserveAspectRatio'", vg.getv(obj, "ratio"));
    if (properties.url)
      sc.call(".attr", "'xlink:href'", vg.get(properties.url));
    ["x","y","width","height"].forEach(function(p) {
      sc.call(".attr", vg.str(p), vg.getv(obj, p));
    });
  }
});
vg.mark.register("line", {
  svg: "path",
  group: true,
  reserved: [
    "interpolate",
    "tension"
  ],
  attr: function(properties, sc) {
    var o = vg.mark.obj + "[i]";
    sc.chain()
      .push(".attr('d', d3.svg.line()")
      .call(".x", vg.getv(o, "x"))
      .call(".y", vg.getv(o, "y"));
    if (properties.interpolate !== undefined)
      sc.call(".interpolate", vg.value(properties.interpolate));
    if (properties.tension !== undefined)
      sc.call(".tension", vg.value(properties.tension));
    sc.unchain(1, true);
  }
});vg.mark.register("path", {
  svg: "path",
  reserved: ["path"],
  attr: function(properties, sc) {
    var o = vg.mark.obj;
    sc.call(".attr", "'transform'", "function() { "
        + "return 'translate('+"+o+".x+','+"+o+".y+')'; }")
      .call(".attr", "'d'", vg.getv(o, "path"));
  }
});vg.mark.register("rect", {
  svg: "rect",
  attr: function(properties, sc) {
    var o = vg.mark.obj;
    ["x","y","width","height"].forEach(function(p) {
      sc.call(".attr", vg.str(p), vg.getv(o, p));
    });
  }
});vg.mark.register("text", {
  svg: "text",
  reserved: ["text", "align", "baseline", "rotate", "xMargin", "yMargin"],
  encode: function(properties, sc) {
    if (properties.align) {
      sc.decl("align", vg.value(properties.align))
        .push("o.align = align==='right' ? 'end' "
          + ": align==='center' ? 'middle' : 'start';");
    }
    if (properties.baseline) {
      sc.decl("baseline", vg.value(properties.baseline))
        .push("o.dy = baseline==='top' ? '.71em' "
          + ": baseline==='middle' ? '.35em' : '0em';");
    }
    if (properties.angle !== undefined) {
      sc.push("o.angle = -1 * " + vg.value(properties.angle) + ";");
    }
    if (properties.xMargin !== undefined) {
      sc.decl("dx", "(typeof(align)!=='undefined' && align!=='left' "
          + "? (align==='right'?-1:0) : 1)")
        .push("o.x += dx * "+vg.value(properties.xMargin) + ";");
    }
    if (properties.yMargin !== undefined) {
      sc.decl("dy", "(typeof(baseline)!=='undefined' && baseline!=='top' "
          + "? (baseline==='bottom'?-1:0) : 1)")
        .push("o.y += dy * "+vg.value(properties.yMargin) + ";");
    }
  },
  attr: function(properties, sc) {
    var o = vg.mark.obj;
    if (properties.text !== undefined) {
      sc.call(".text", vg.get(properties.text));
    }
    if (properties.angle !== undefined) {
      sc.call(".attr", "'transform'", "function() { return "
        + "'rotate('+"+o+".angle+', '+"+o+".x+', '+"+o+".y+')'; }");
    }
    ["x","y"].forEach(function(p) {
      sc.call(".attr", vg.str(p), vg.getv(o, p));
    });
    if (properties.align) {
      sc.call(".attr", "'text-anchor'", vg.getv(o, "align"));
    }
    if (properties.baseline) {
      sc.call(".attr", "'dy'", vg.getv(o, "dy"));
    }
  }
});
vg.encoders = function(spec, sc) {
  if (!spec.encoders) return;
  spec.encoders.forEach(function(enc, index) {
    if (index > 0) sc.push();
    vg.encoder.init(enc, sc);
  });
};

vg.encoder = {};
vg.encoder.meta = {"name":true, "type":true};
vg.encoder.registry = {};

vg.encoder.register = function(name, pkg) {
  pkg = vg.isFunction(pkg) ? pkg() : pkg;
  if (vg.isObject(pkg.method) && !vg.isFunction(pkg.method)) {
    for (var methodName in pkg.method) {
      var enc = vg.clone(pkg);
      enc.method = pkg.method[methodName];
      var registryName = name + (methodName ? "."+methodName : "");
      vg.encoder.registry[registryName] = enc;
    }
  } else {
    vg.encoder.registry[name] = pkg;
  }
};

vg.encoder.init = function(def, sc) {
  var type = def.type.split("."),
      encoder = vg.encoder.registry[type.shift()];
  if (!encoder) {
    vg.error("Unrecognized encoder type: "+def.type);
  }
  var method = encoder.method;
  if (vg.isFunction(method)) {
    method = method(type.join("."));
  } 
  if (method === undefined) return;
  
  sc.chain().push("encoders['"+def.name+"'] = "+method+"()");  
  if (encoder.init) encoder.init(def, sc);
  sc.unchain();
};

vg.encoder.start = function(def, spec, mark, index, sc) {
  var type = def.type.split("."),
      encoder = vg.encoder.registry[type[0]];
  if (encoder.start) encoder.start(def, spec, mark, index, sc);  
};

vg.encoder.encode = function(def, spec, mark, index, sc) {
  var type = def.type.split("."),
      encoder = vg.encoder.registry[type[0]];
  if (encoder.encode) encoder.encode(def, spec, mark, index, sc);  
};

vg.encoder.finish = function(def, spec, mark, index, sc) {
  var type = def.type.split("."),
      encoder = vg.encoder.registry[type[0]];
  if (encoder.finish) encoder.finish(def, spec, mark, index, sc);
};
vg.encoder.register("geo", function() {

  var input = ["lon", "lat"],
      output = ["x", "y"],
      params = ["center", "scale", "translate",
                "rotate", "precision", "clipAngle"];

  var method = function(projection) {
    return "d3.geo."+projection;
  };

  return {
    input: input,
    output: output,
    params: params,
    method: method,
    
    init: function(def, sc) {
      params.forEach(function(param) {
        if (def[param]) sc.call("."+param, vg.value(def[param]));
      });
    },
    
    start: function(def, spec, mark, index, sc) {
      sc.chain().decl(vg.varname("geo", index), "encoders['"+def.name+"']");
      params.forEach(function(p) {
        // update parameter if override present
        if (def[p] !== spec[p]) sc.call("."+p, vg.value(spec[p]));
      });
      sc.unchain();
    },
    
    encode: function(def, spec, mark, index, sc) {
      var name = vg.varname("geo", index),
          lon = vg.value(spec.lon),
          lat = vg.value(spec.lat);

      sc.decl("xy", name+"(["+lon+", "+lat+"])")
        .push("o.x = xy[0];")
        .push("o.y = xy[1];");
    },
    
    finish: function(def, spec, mark, index, sc) {
      // return parameters to initial values, if necessary
      var override = params.filter(function(p) { return def[p] !== spec[p]; });
      if (override.length === 0) return;
      sc.chain().push(vg.varname("geo", index));
      override.forEach(function(p) { sc.call("."+param, def[p]); });
      sc.unchain();
    }
  };
  
});vg.encoder.register("geojson", {

  input: ["field"],
  params: ["projection"],
  output: ["path"],
  method: "d3.geo.path",

  init: function(def, sc) {
    if (def.projection) sc.call(".projection", "encoders['"+def.projection+"']");
  },
  
  start: function(def, spec, mark, index, sc) {
    var name = vg.varname("geojson", index);
    sc.chain().decl(name, "encoders['"+spec.name+"']");
    if (spec.projection !== def.projection) {
      // update projection if override present
      sc.call(".projection", "encoders['"+spec.projection+"']")
    }
    sc.unchain();
  },
  
  encode: function(def, spec, mark, index, sc) {
    var name = vg.varname("geojson", index),
        field = vg.value(spec.field);
    sc.push("o.path = "+name+"("+field+");");
  },
  
  finish: function(def, spec, mark, index, sc) {
    // return projection to initial value, if necessary
    if (def.projection && spec.projection !== def.projection) {
      var name = vg.varname("geojson", index);
      sc.call(name+".projection", "encoders['"+def.projection+"']");
    }
  }
  
});vg.encoder.register("pie", {

  input: ["field"],
  output: ["startAngle", "endAngle"],
  method: undefined,
    
  start: function(def, spec, mark, index, sc) {
    var name = vg.varname("pie", index);
    sc.chain().decl(name, "d3.layout.pie()").call(".sort","null");
    if (spec.field !== undefined) sc.call(".value", vg.get(spec.field));
    sc.push("(data['"+mark.from+"'])")
      .unchain();
  },
  
  encode: function(def, spec, mark, index, sc) {
    var name = vg.varname("pie", index);
    sc.push("o.startAngle = "+name+"[i].startAngle;")
      .push("o.endAngle = "+name+"[i].endAngle;");
  }
  
});vg.encoder.register("stack", {

  input: ["x", "y"],
  params: ["offset", "order", "scale"],
  output: ["x", "y", "height"],
  method: undefined,
    
  start: function(def, spec, mark, index, sc) {
    var name = vg.varname("stack", index);
    sc.chain().decl(name, "d3.layout.stack()");
    if (spec.offset !== undefined) {
      sc.call(".offset", vg.value(spec.offset));
    }
    if (spec.order !== undefined) {
      sc.call(".order", vg.value(spec.order));
    }
    sc.call(".x", vg.get(spec.x, true))
      .call(".y", vg.get(spec.y, true))
      .push("("+vg.from(mark.from)+")")
      .unchain();
  },
  
  encode: function(def, spec, mark, index, sc) {
    sc.decl("so", "d");
    if (spec.scale) {
      var s = "scales['"+spec.scale+"']";
      sc.decl("y1", s+"(so.y0)")
        .decl("y2", s+"(so.y0 + so.y)")
        .push("if (y1 > y2) { var tmp = y1; y1 = y2; y2 = tmp; }")
        .push("o.y = y1;")
        .push("o.height = (y2-y1);");
    } else {
      sc.push("o.y = so.y0;")
        .push("o.height = so.y;");
    }
  }
});vg.encoder.register("symbol", {

  params: ["shape", "size"],
  output: ["path"],
  method: undefined,

  start: function(def, spec, mark, index, sc) {
    var name = vg.varname("symbol", index);
    sc.chain().decl(name, "d3.svg.symbol()");
    if (spec.shape) sc.call(".type", vg.get(spec.shape));
    if (spec.size) sc.call(".size", vg.get(spec.size));
    sc.unchain();
  },
  
  encode: function(def, spec, mark, index, sc) {
    var name = vg.varname("symbol", index);
    sc.push("o.path = "+name+"(d);");
  }
  
});vg.encoder.register("treemap", {

  input: ["value"],
  params: ["round", "sticky", "ratio", "padding", "size"],
  output: ["x", "y", "width", "height"],
  method: "d3.layout.treemap",

  init: function(def, sc) {
    ["round", "sticky", "ratio", "padding"].forEach(function(p) {
      if (def[p] === undefined) return;
      sc.call("."+p, vg.value(def[p]));
    });
  },

  start: function(def, spec, mark, index, sc) {
    var name = vg.varname("treemap", index);

    sc.chain().decl(name, "encoders['"+spec.name+"']")
      .call(".size", spec.size ? vg.value(spec.size) : "[width, height]")
      .call(".children", "function(d) { return d.values; }")
      .call(".value", vg.get(spec.value, true))
      .call(".nodes", vg.from(mark.from, false))
      .unchain();
  },
  
  encode: function(def, spec, mark, index, sc) {
    sc.decl("so", "d")
      .push("o.x = so.x")
      .push("o.y = so.y")
      .push("o.width = so.dx")
      .push("o.height = so.dy");
  }
});vg.dom = function(spec, sc) {
  // create container div
  sc.chain()
    .push("dom = d3.select(el)")
    .call(".append", "'div'");
  if (spec.clientWidth || spec.clientHeight) {
    sc.call(".style", "{"
      + (spec.clientWidth  ? "width:'"  + spec.clientWidth  + "px', " : "")
      + (spec.clientHeight ? "height:'" + spec.clientHeight + "px', " : "")
      + "overflow:'auto'"
      + "}");
  }
  sc.unchain().push();
  
  // create SVG element
  sc.chain()
    .decl("svg", "dom.append('svg')")
    .call(".attr", "'width'", "width + padding.left + padding.right")
    .call(".attr", "'height'", "height + padding.top + padding.bottom")
    .unchain();

  sc.push();
    
  // create root SVG container
  sc.chain()
    .decl("root", "svg.append('g')")
    .call(".attr", "'class'", "root")
    .call(".attr", "'transform'", "'translate('+padding.left+', '+padding.top+')'")
    .unchain();
    
  sc.push();

  // create axes container
  sc.chain()
    .push("root.selectAll('g.axis')")
    .call(".data", "axes")
    .push(".enter().append('g')").indent()
    .call(".attr", "'class'", "function(d, i) { return 'axis axis-'+i; }")
    .unindent()
    .unchain();

  sc.push();

  // create mark containers
  sc.chain()
    .push("root.selectAll('g.mark')")
    .call(".data", "d3.range("+spec.marks.length+")")
    .push(".enter().append('g')").indent()
    .call(".attr", "'class'", "function(d, i) { "
      + "return 'mark mark-'+i; }")
    .unindent()
    .unchain();
};
  
vg.compile = function(spec, template) {
  var js = vg.template(template),
      sc = vg.code();
      
  // make deep copy to avoid modification
  spec = vg.copy(spec);
      
  var defaults = {
    name: "chart",
    width: 400,
    height: 400,
    padding: {top:30, bottom:30, left:30, right:30},
    duration: 0
  };

  // PARAMETERS
  js.set("NAME", vg_compile_name(spec.name) || defaults.name);
  js.set("WIDTH", spec.width || defaults.width);
  js.set("HEIGHT", spec.height || defaults.height);
  js.set("DURATION", spec.duration || defaults.duration);
  js.set("PADDING", vg_compile_padding(spec.padding) || defaults.padding);

  // INITIALIZATION

  // data
  vg.data.load(spec, sc.clear().indent(2));
  js.set("LOAD_DATA", sc.source());
  vg.data(spec, sc.clear().indent(2));
  js.set("UPDATE_DATA", sc.source());
  
  // scales
  vg.scales(spec, sc.clear().indent(2));
  js.set("INIT_SCALES", sc.source());

  // encoders
  vg.encoders(spec, sc.clear().indent(2));
  js.set("INIT_ENCODERS", sc.source());

  // axes
  vg.axes(spec, sc.clear().indent(2));
  js.set("INIT_AXES", sc.source());

  // marks
  vg.marks(spec, sc.clear().indent(2));
  js.set("INIT_MARKS", sc.source());
  
  // DOM element
  vg.dom(spec, sc.clear().indent(2));
  js.set("INIT_DOM", sc.source());
  
  // UPDATE
  
  // axes
  vg.axes.update(spec, sc.clear().indent(2));
  js.set("UPDATE_AXES", sc.source());
  
  return js.toString();
};

var vg_compile_name_re = /([:;,'`"<>=~!@#\$%\^\&(){}\[\]\|\?\.\*\+\/\\])/g,
    vg_compile_space_re = /([ -]+)/g;

function vg_compile_name(name) {
  if (name) name = name.replace(vg_compile_name_re, "");
  return name ? name.replace(vg_compile_space_re, "_") : name;
}

function vg_compile_padding(pad) {
  if (pad !== undefined && !vg.isObject(pad)) {
    pad = {top:pad, bottom:pad, left:pad, right:pad};
  }
  return pad;
}
})();
