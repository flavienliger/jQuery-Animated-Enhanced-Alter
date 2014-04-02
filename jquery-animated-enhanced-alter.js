/*
jquery.animate-enhanced plugin v1.08
---
http://github.com/benbarnett/jQuery-Animate-Enhanced
http://benbarnett.net
@benpbarnett
---
Copyright (c) 2013 Ben Barnett

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
---
*/

// FIXME: '-=' fail why translate

(function(jQuery, originalAnimateMethod, originalStopMethod) {

	// ----------
	// Plugin variables
	// ----------
	var	cssTransitionProperties = ['marginLeft', 'marginTop', 'top', 'right', 'bottom', 'left', 'rotate', 'scale', 'opacity', 'height', 'width'],
		directions = ['top', 'right', 'bottom', 'left'],
		transform = ['rotate', 'scale', 'translate'],
		cssPrefixes = ['-webkit-', '-moz-', '-o-', ''],
		pluginOptions = ['avoidTransforms', 'useTranslate3d', 'leaveTransforms'],
		rfxnum = /^([+-]=)?([\d+-.]+)(.*)$/,
		rupper = /([A-Z])/g,
		defaultEnhanceData = {
			secondary: {},
			meta: {
				top : 0,
				right : 0,
				bottom : 0,
				left : 0
			},
			pause: {
				transform : {},
				property : {},
				actif : false,
				update: {}
			}
		},
		valUnit = 'px',

		DATA_KEY = 'jQe',
		CUBIC_BEZIER_OPEN = 'cubic-bezier(',
		CUBIC_BEZIER_CLOSE = ')',

		originalAnimatedFilter = null,
		pluginDisabledDefault = false;


	// ----------
	// Check if this browser supports CSS3 transitions
	// ----------
	var thisBody = document.body || document.documentElement,
		thisStyle = thisBody.style,
		transitionEndEvent = 'webkitTransitionEnd oTransitionEnd transitionend',
		cssTransitionsSupported = thisStyle.WebkitTransition !== undefined || thisStyle.MozTransition !== undefined || thisStyle.OTransition !== undefined || thisStyle.transition !== undefined,
		has3D = ('WebKitCSSMatrix' in window && 'm11' in new WebKitCSSMatrix()),
		use3DByDefault = has3D;



	// ----------
	// Extended :animated filter
	// ----------
	if ( jQuery.expr && jQuery.expr.filters ) {
		originalAnimatedFilter = jQuery.expr.filters.animated;
		jQuery.expr.filters.animated = function(elem) {
			return jQuery(elem).data('events') && jQuery(elem).data('events')[transitionEndEvent] ? true : originalAnimatedFilter.call(this, elem);
		};
	}


	/**
		@private
		@name _getUnit
		@function
		@description Return unit value ("px", "%", "em" for re-use correct one when translating)
		@param {variant} [val] Target value
	*/
	function _getUnit(val){
		return val.match(/\D+$/);
	}


	function _getValueTransform(e, val) {
		var trans = new Transform(e).get();	
		if(val == 'rotate')
			return trans.rotateZ;
		if(val == 'scale')
			return trans.scaleX;
	}
	
	/**
		@private
		@name _interpretValue
		@function
		@description Interpret value ("px", "+=" and "-=" sanitisation)
		@param {object} [element] The Element for current CSS analysis
		@param {variant} [val] Target value
		@param {string} [prop] The property we're looking at
		@param {boolean} [isTransform] Is this a CSS3 transform?
	*/
	function _interpretValue(e, val, prop, isTransform) {
		// this is a nasty fix, but we check for prop == 'd' to see if we're dealing with SVG, and abort
		if (prop == "d") return;
		if (!_isValidElement(e)) return;
		
		var parts = rfxnum.exec(val),
			start = ($.inArray(prop, transform)!=-1)? _getValueTransform(e, prop): e.css(prop) === 'auto' ? 0 : e.css(prop),
			cleanCSSStart = typeof start == 'string' ? _cleanValue(start) : start,
			cleanTarget = typeof val == 'string' ? _cleanValue(val) : val,
			cleanStart = isTransform === true ? 0 : cleanCSSStart,
			hidden = e.is(':hidden'),
			translation = e.translation();

		if (prop == 'left') cleanStart = parseInt(cleanCSSStart, 10) + translation.x;
		if (prop == 'right') cleanStart = parseInt(cleanCSSStart, 10) + translation.x;
		if (prop == 'top') cleanStart = parseInt(cleanCSSStart, 10) + translation.y;
		if (prop == 'bottom') cleanStart = parseInt(cleanCSSStart, 10) + translation.y;

		// deal with shortcuts
		if (!parts && val == 'show') {
			cleanStart = 1;
			if (hidden) {
				elem = e[0];
				if (elem.style) {
					display = elem.style.display;

					// Reset the inline display of this element to learn if it is
					// being hidden by cascaded rules or not
					if (!jQuery._data(elem, 'olddisplay') && display === 'none') {
						display = elem.style.display = '';
					}

					// Set elements which have been overridden with display: none
					// in a stylesheet to whatever the default browser style is
					// for such an element
					if ( display === '' && jQuery.css(elem, 'display') === 'none' ) {
						jQuery._data(elem, 'olddisplay', _domElementVisibleDisplayValue(elem.tagName));
					}

					if (display === '' || display === 'none') {
						elem.style.display = jQuery._data(elem, 'olddisplay') || '';
					}
				}
				e.css('opacity', 0);
			}
		} else if (!parts && val == 'hide') {
			cleanStart = 0;
		}

		if (parts) {
			var end = parseFloat(parts[2]);
			
			// If a +=/-= token was provided, we're doing a relative animation
			if (parts[1]) end = ((parts[1] === '-=' ? -1 : 1) * end) + parseInt(cleanStart, 10);

			// check for unit  as per issue #69
			if (parts[3] && parts[3] != 'px') end = end + parts[3];
			
			return end;
		} else {
			return cleanStart;
		}
	}

	/**
		@private
		@name _getTranslate
		@function
		@description Make a matrix with property
		@param {Object.<left, top, rotate>} meta 
		@param {boolean} [use3D] Use translate3d if available? NOT USE
		@returns {String} Matrix
	*/
	function _getTranslate(e, meta, use3D) {
		var z = null;
		// 3d actif by default
		//if((use3D === true || ((use3DByDefault === true && use3D !== false)) && has3D))
		//	z = 1;
			
		var transform = new Transform(e);
		transform.translate( meta.left, meta.top, z );
		if(meta.rotate !== undefined)
			transform.rotate( meta.rotate );
		if(meta.scale !== undefined)
			transform.scale( meta.scale, meta.scale );
		
		return  transform.getCssFormat();
	}

	/**
		@private
		@name _applyCSSTransition
		@function
		@description Build up the CSS object
		@param {object} [e] Element
		@param {string} [property] Property we're dealing with
		@param {integer} [duration] Duration
		@param {string} [easing] Easing function
		@param {variant} [value] String/integer for target value
		@param {boolean} [isTransform] Is this a CSS transformation?
		@param {boolean} [isTranslatable] Is this a CSS translation?
		@param {boolean} [use3D] Use translate3d if available?
	*/
	function _applyCSSTransition(e, property, duration, easing, value, isTransform, isTranslatable, use3D) {
		var eCSSData = e.data(DATA_KEY),
			enhanceData = eCSSData && !_isEmptyObject(eCSSData) ? eCSSData : jQuery.extend(true, {}, defaultEnhanceData),
			offsetPosition = parseFloat(value),
			isDirection = jQuery.inArray(property, directions) > -1;

		if (isDirection) {
			var meta = enhanceData.meta,
				cleanPropertyValue = _cleanValue(e.css(property)) || 0,
				stashedProperty = property + '_o';

			offsetPosition = value - cleanPropertyValue;


			meta[property] = offsetPosition;
			meta[stashedProperty] = e.css(property) == 'auto' ? 0 + offsetPosition : cleanPropertyValue + offsetPosition || 0;
			enhanceData.meta = meta;
			enhanceData.pause['transform']['translate'+(property=='left'? 'X':'Y')] = offsetPosition;
			
			// fix 0 issue (transition by 0 = nothing)
			/*if (isTranslatable && offsetPosition === 0) {
				offsetPosition = 0 - meta[stashedProperty];
				meta[property] = offsetPosition;
				meta[stashedProperty] = 0;
			}*/
		}
		else if(isTransform) {
			var meta = enhanceData.meta;
			meta[property] = offsetPosition;
			enhanceData.pause['transform'][property] = offsetPosition;
		}
		else{
			enhanceData.pause['property'][property] = parseFloat(value);
			enhanceData.pause['property'][property+'_o'] = parseFloat(e.css(property));
		}
		
		e.data(DATA_KEY, _applyCSSWithPrefixTransition(e, enhanceData, duration, easing));
		
		// reapply data and return
		return e.data(DATA_KEY, _applyCSSWithPrefix(e, enhanceData, property, duration, easing, offsetPosition, isTransform, isTranslatable, use3D));
	}

	/**
		@private
		@name _applyCSSWithPrefix
		@function
		@description Add css properties for transition
		@param {object} [cssProperties] Current CSS object to merge with
		@param {integer} [duration]
		@param {string} [easing]
	*/	
	function _applyCSSWithPrefixTransition(e, cssProperties, duration, easing) {
		var cssProperties = cssProperties || {};
		cssProperties.properties = cssProperties.properties||{};
		
		var saveOriginal = false;
		if (!cssProperties.original) {
			cssProperties.original = {};
			saveOriginal = true;
		}
		
		var properties = cssProperties.properties,
			original = cssProperties.original;
		
		for (var i = cssPrefixes.length - 1; i >= 0; i--) {
			var tp = cssPrefixes[i] + 'transition-property',
				td = cssPrefixes[i] + 'transition-duration',
				tf = cssPrefixes[i] + 'transition-timing-function'//,
				//bv = cssPrefixes[i] + 'backface-visibility';

			if (saveOriginal) {
				original[tp] = e.css(tp) || '';
				original[td] = '0.001s';//e.css(td) || '';
				original[tf] = e.css(tf) || '';
			}

			properties[tp] = 'all';
			properties[td] = duration + 'ms';
			properties[tf] = easing;
			//properties[bv] = 'hidden';
		}
		
		return cssProperties;
	}

	/**
		@private
		@name _applyCSSWithPrefix
		@function
		@description Helper function to build up CSS properties using the various prefixes
		@param {object} [cssProperties] Current CSS object to merge with
		@param {string} [property]
		@param {integer} [duration]
		@param {string} [easing]
		@param {variant} [value]
		@param {boolean} [isTransform] Is this a CSS transformation?
		@param {boolean} [isTranslatable] Is this a CSS translation?
		@param {boolean} [use3D] Use translate3d if available?
	*/
	function _applyCSSWithPrefix(e, cssProperties, property, duration, easing, value, isTransform, isTranslatable, use3D) {
		var transform = isTransform === true && isTranslatable === true;

		cssProperties = cssProperties || {};
		cssProperties.properties = cssProperties.properties || {};
		cssProperties.secondary = cssProperties.secondary || {};

		var meta = cssProperties.meta,
			pause = cssProperties.pause,
			secondary = cssProperties.secondary;
		
		for (var i = cssPrefixes.length - 1; i >= 0; i--) {

			property = (transform ? cssPrefixes[i] + 'transform' : property);
			secondary[property] = transform ? _getTranslate(e, meta, use3D) : value;
		}
		pause['original'] = new Transform(e).get(true);
		pause['duration'] = duration;
		
		return cssProperties;
	}

	/**
		@private
		@name _isBoxShortcut
		@function
		@description Shortcut to detect if we need to step away from slideToggle, CSS accelerated transitions (to come later with fx.step support)
		@param {object} [prop]
	*/
	function _isBoxShortcut(prop) {
		for (var property in prop) {
			if ((property == 'width' || property == 'height') && (prop[property] == 'show' || prop[property] == 'hide' || prop[property] == 'toggle')) {
				return true;
			}
		}
		return false;
	}


	/**
		@private
		@name _isEmptyObject
		@function
		@description Check if object is empty (<1.4 compatibility)
		@param {object} [obj]
	*/
	function _isEmptyObject(obj) {
		for (var i in obj) {
			return false;
		}
		return true;
	}

	/**
	 * Fetch most appropriate display value for element types
	 * @see  https://github.com/benbarnett/jQuery-Animate-Enhanced/issues/121
	 * @private
	 * @param  {[type]} tagName [description]
	 * @return {[type]}         [description]
	 */
	function _domElementVisibleDisplayValue(tagName) {
		tagName = tagName.toUpperCase();
		var displayValues = {
			'LI'       : 'list-item',
			'TR'       : 'table-row',
			'TD'       : 'table-cell',
			'TH'       : 'table-cell',
			'CAPTION'  : 'table-caption',
			'COL'      : 'table-column',
			'COLGROUP' : 'table-column-group',
			'TFOOT'      : 'table-footer-group',
			'THEAD'      : 'table-header-group',
			'TBODY'      : 'table-row-group'
		};

		return typeof displayValues[tagName] == 'string' ? displayValues[tagName] : 'block';
	}


	/**
		@private
		@name _cleanValue
		@function
		@description Remove 'px' and other artifacts
		@param {variant} [val]
	*/
	function _cleanValue(val) {
		return parseFloat(val.replace(_getUnit(val), ''));
	}


	function _isValidElement(element) {
		var allValid=true;
		element.each(function(index, el) {
			allValid = allValid && el.ownerDocument;
			return allValid;
		});
		return allValid;
	}

	/**
		@private
		@name _appropriateProperty
		@function
		@description Function to check if property should be handled by plugin
		@param {string} [prop]
		@param {variant} [value]
	*/
	function _appropriateProperty(prop, value, element) {
		if (!_isValidElement(element)) {
			return false;
		}
		
		var is = jQuery.inArray(prop, cssTransitionProperties) > -1;
		if ((prop == 'width' || prop == 'height' || prop == 'opacity') && (parseFloat(value) === parseFloat(element.css(prop)))) is = false;
		return is;
	}

	
	/**
		@private
		@name _checkCSS
		@function
		@description Function for check if the css is already used
		@param {jQuery} [e] - element
		@param {String} [key] - key of css
		@param {String|Number} [value] - value of css
	*/
	function _checkCSS(e, key, value) {
		
		var val;
		
		// opacity
		if(typeof value=='string'){
			val = value=='show'? 'block' : 'none';
		}
		else{
			val = parseFloat(value);
		}
		
		// isTransform
		if($.inArray(key, transform) != -1) {
			var trans = new Transform(e).get();
			
			if ( key == 'rotate' ) {
				if( trans.rotateZ == val ) {
					return false;	
				}
			}
			if( key == 'scale' ) {
				if(	trans.scaleX == val ) {
					return false;	
				}
			}
			
			return true;
		}
		else {
			// check display for opacity
			var css = (typeof val == 'string')? e.css('display'): parseFloat(e.css(key));
			
			if( css == val ) {
				return false;
			}
			return true;
		}
	}
	

	jQuery.extend({
		/**
			@public
			@name toggle3DByDefault
			@function
			@description Toggle for plugin settings to automatically use translate3d (where available). Usage: $.toggle3DByDefault
		*/
		toggle3DByDefault: function() {
			return use3DByDefault = !use3DByDefault;
		},
		
		
		/**
			@public
			@name toggleDisabledByDefault
			@function
			@description Toggle the plugin to be disabled by default (can be overridden per animation with avoidCSSTransitions)
		*/
		toggleDisabledByDefault: function() {
			return pluginDisabledDefault = !pluginDisabledDefault;
		},


		/**
			@public
			@name setDisabledByDefault
			@function
			@description Set or unset the 'disabled by default' value
		*/
		setDisabledByDefault: function(newValue) {
			return pluginDisabledDefault = newValue;
		}
	});


	/**
		@public
		@name translation
		@function
		@description Get current X and Y translations
	*/
	jQuery.fn.translation = function() {
		if (!this[0]) {
			return null;
		}

		var	elem = this[0],
			cStyle = new Transform(elem).get(),
			translation = {x: 0, y: 0};
		
		if(cStyle.translateX || cStyle.translateY){
			translation = {
				x: cStyle.translateX||0,
				y: cStyle.translateY||0
			};
		}
		return translation;
	};
	
	var nextQueue = function(e){
		if(e.data('queue')){
			var queue = e.data('queue');
			var act = e.data('queue-state');
			
			if(act>=queue.length)
				return false;
			
			e.animate.apply(e, queue[act]);
			
			act ++;
			e.data('queue-state', act);
		}
		return false;
	};
	

	/**
		@public
		@name jQuery.fn.animate
		@function
		@description The enhanced jQuery.animate function
		@param {string} [property]
		@param {string} [speed]
		@param {string} [easing]
		@param {function} [callback]
	*/
	jQuery.fn.animate = function(prop, speed, easing, callback) {

		var chain = false;
		var arg = arguments;
		
		$(this).each(function(i, obj){
			// already animate
			if($(obj).data(DATA_KEY)){
				// queue
				var queue = [];
				if($(this).data('queue')){
					queue = $(this).data('queue');	
				}
				queue.push(arg);
				$(this).data('queue', queue);
				
				if($(this).data('queue-state')===undefined){
					$(this).data('queue-state', 0);
				}
				chain = true; 
			}
		});
		if(chain) return this;

		prop = prop || {};
		var isTranslatable = !(prop['bottom'] !== undefined || prop['right'] !== undefined),
			optall = jQuery.speed(speed, easing, callback),
			callbackQueue = 0,
			propertyCallback = function() {
				optall.complete.apply(this, arguments);
				
				// old chain system
				/*callbackQueue--;
				if (callbackQueue === 0) {
					// we're done, trigger the user callback
					if (typeof optall.complete === 'function') {
						optall.complete.apply(this, arguments);
					}
				}*/
			},
			bypassPlugin = (typeof prop['avoidCSSTransitions'] !== 'undefined') ? prop['avoidCSSTransitions'] : pluginDisabledDefault;

		if (bypassPlugin === true || !cssTransitionsSupported || _isEmptyObject(prop) || _isBoxShortcut(prop) || optall.duration <= 0 || optall.step) {
			return originalAnimateMethod.apply(this, arguments);
		}

		return this[ optall.queue === true ? 'queue' : 'each' ](function() {
			var self = jQuery(this),
				opt = jQuery.extend({}, optall),
				// END
				cssCallback = function(e) {
					var selfCSSData = self.data(DATA_KEY) || { original: {} },
						restore = {};
					
					// not at dispatching target (thanks @warappa issue #58)
					if (e.eventPhase != 2)  
						return;

					if (selfCSSData.pause && selfCSSData.pause.actif)
						return;
					
					for (var i = cssPrefixes.length - 1; i >= 0; i--) {
						selfCSSData.original[cssPrefixes[i]+'transition-duration'] = '0s';
					}
					
					// convert translations to left & top for layout
					if (prop.leaveTransforms !== true) {
						for (var i = cssPrefixes.length - 1; i >= 0; i--) {
							// TODO: right/bottom crash
							// reset transform
							if(selfCSSData.secondary && selfCSSData.secondary.transform){
								restore[cssPrefixes[i] + 'transform'] = 
									new Transform(selfCSSData.secondary.transform)
									.translate( -selfCSSData.meta.left, -selfCSSData.meta.top)
									.getCssFormat();
							}
						}
						if (isTranslatable && typeof selfCSSData.meta !== 'undefined') {
							for (var j = 0, dir; (dir = directions[j]); ++j) {
								if(selfCSSData.meta[dir + '_o'] !== undefined){
									restore[dir] = selfCSSData.meta[dir + '_o'] + valUnit;
									//jQuery(this).css(dir, restore[dir]);
								}
							}
						}
					}
					
					// remove transition timing functions
					self.unbind(transitionEndEvent)
						.removeClass('in-transition')
						.css(selfCSSData.original)
					
					// fix android latency
					setTimeout(function(){
						self.css(restore)
							.data(DATA_KEY, null);
						

						setTimeout(function(){
							// run the main callback function
							propertyCallback.apply(self, [e]);
							
							nextQueue(self);
						}, 50);
					},50);
					
					// if we used the fadeOut shortcut make sure elements are display:none
					if (prop.opacity === 'hide') {
						elem = self[0];
						if (elem.style) {
							display = jQuery.css(elem, 'display');

							if (display !== 'none' && !jQuery._data(elem, 'olddisplay')) {
								jQuery._data(elem, 'olddisplay', display);
							}
							elem.style.display = 'none';
						}

						self.css('opacity', '');
					}
					
				},
				easings = {
					bounce: CUBIC_BEZIER_OPEN + '0.0, 0.35, .5, 1.3' + CUBIC_BEZIER_CLOSE,
					linear: 'linear',
					easeInOut: 'ease-in-out',

					// Penner equation approximations from Matthew Lein's Ceaser: http://matthewlein.com/ceaser/
					easeInQuad:     CUBIC_BEZIER_OPEN + '0.550, 0.085, 0.680, 0.530' + CUBIC_BEZIER_CLOSE,
					easeInCubic:    CUBIC_BEZIER_OPEN + '0.550, 0.055, 0.675, 0.190' + CUBIC_BEZIER_CLOSE,
					easeInQuart:    CUBIC_BEZIER_OPEN + '0.895, 0.030, 0.685, 0.220' + CUBIC_BEZIER_CLOSE,
					easeInQuint:    CUBIC_BEZIER_OPEN + '0.755, 0.050, 0.855, 0.060' + CUBIC_BEZIER_CLOSE,
					easeInSine:     CUBIC_BEZIER_OPEN + '0.470, 0.000, 0.745, 0.715' + CUBIC_BEZIER_CLOSE,
					easeInExpo:     CUBIC_BEZIER_OPEN + '0.950, 0.050, 0.795, 0.035' + CUBIC_BEZIER_CLOSE,
					easeInCirc:     CUBIC_BEZIER_OPEN + '0.600, 0.040, 0.980, 0.335' + CUBIC_BEZIER_CLOSE,
					easeInBack:     CUBIC_BEZIER_OPEN + '0.600, -0.280, 0.735, 0.045' + CUBIC_BEZIER_CLOSE,
					easeOutQuad:    CUBIC_BEZIER_OPEN + '0.250, 0.460, 0.450, 0.940' + CUBIC_BEZIER_CLOSE,
					easeOutCubic:   CUBIC_BEZIER_OPEN + '0.215, 0.610, 0.355, 1.000' + CUBIC_BEZIER_CLOSE,
					easeOutQuart:   CUBIC_BEZIER_OPEN + '0.165, 0.840, 0.440, 1.000' + CUBIC_BEZIER_CLOSE,
					easeOutQuint:   CUBIC_BEZIER_OPEN + '0.230, 1.000, 0.320, 1.000' + CUBIC_BEZIER_CLOSE,
					easeOutSine:    CUBIC_BEZIER_OPEN + '0.390, 0.575, 0.565, 1.000' + CUBIC_BEZIER_CLOSE,
					easeOutExpo:    CUBIC_BEZIER_OPEN + '0.190, 1.000, 0.220, 1.000' + CUBIC_BEZIER_CLOSE,
					easeOutCirc:    CUBIC_BEZIER_OPEN + '0.075, 0.820, 0.165, 1.000' + CUBIC_BEZIER_CLOSE,
					easeOutBack:    CUBIC_BEZIER_OPEN + '0.175, 0.885, 0.320, 1.275' + CUBIC_BEZIER_CLOSE,
					easeInOutQuad:  CUBIC_BEZIER_OPEN + '0.455, 0.030, 0.515, 0.955' + CUBIC_BEZIER_CLOSE,
					easeInOutCubic: CUBIC_BEZIER_OPEN + '0.645, 0.045, 0.355, 1.000' + CUBIC_BEZIER_CLOSE,
					easeInOutQuart: CUBIC_BEZIER_OPEN + '0.770, 0.000, 0.175, 1.000' + CUBIC_BEZIER_CLOSE,
					easeInOutQuint: CUBIC_BEZIER_OPEN + '0.860, 0.000, 0.070, 1.000' + CUBIC_BEZIER_CLOSE,
					easeInOutSine:  CUBIC_BEZIER_OPEN + '0.445, 0.050, 0.550, 0.950' + CUBIC_BEZIER_CLOSE,
					easeInOutExpo:  CUBIC_BEZIER_OPEN + '1.000, 0.000, 0.000, 1.000' + CUBIC_BEZIER_CLOSE,
					easeInOutCirc:  CUBIC_BEZIER_OPEN + '0.785, 0.135, 0.150, 0.860' + CUBIC_BEZIER_CLOSE,
					easeInOutBack:  CUBIC_BEZIER_OPEN + '0.680, -0.550, 0.265, 1.550' + CUBIC_BEZIER_CLOSE
				},
				domProperties = {},
				cssEasing = easings[opt.easing || 'easeInOut'] ? easings[opt.easing || 'easeInOut'] : opt.easing || 'easeInOut';
				//cssEasing = 'linear';
				
			// protect duplicate animation
			var check = false;
			for(var key in prop){
				// check if two css is same
				if(_checkCSS(self, key, prop[key])){
					check = true;	
				}
			}
			
			// all same
			if(!check){
				propertyCallback.apply(this);
				//nextQueue($(this));
				return this;
			}
			
			// seperate out the properties for the relevant animation functions
			for (var p in prop) {
				if (jQuery.inArray(p, pluginOptions) === -1) {
					var isDirection = jQuery.inArray(p, directions) > -1,
						isTransform = jQuery.inArray(p, transform) > -1,
						cleanVal = _interpretValue(self, prop[p], p, (isDirection && prop.avoidTransforms !== true));
					
					if (/**prop.avoidTransforms !== true && **/_appropriateProperty(p, cleanVal, self)) {
						_applyCSSTransition(
							self,
							p,
							opt.duration,
							cssEasing,
							cleanVal, //isDirection && prop.avoidTransforms === true ? cleanVal + valUnit : cleanVal,
							(isDirection && prop.avoidTransforms !== true) || isTransform,
							isTranslatable,
							prop.useTranslate3d);
					}
					else {
						domProperties[p] = prop[p];
					}
				}
			}

			self.unbind(transitionEndEvent);

			var selfCSSData = self.data(DATA_KEY);

			if (selfCSSData && !_isEmptyObject(selfCSSData) && !_isEmptyObject(selfCSSData.secondary)) {
				callbackQueue++;
				
				selfCSSData.pause.easing = cssEasing == easings.easeInOut? 'easeInOut': opt.easing;
				
				// store in a var to avoid any timing issues, depending on animation duration
				var secondary = selfCSSData.secondary;
				
				// has to be done in a timeout to ensure transition properties are set
				setTimeout(function() {
					selfCSSData.pause.timestamp = new Date().getTime();
					
					self.css(selfCSSData.properties)
						.bind(transitionEndEvent, cssCallback)
						.addClass('in-transition')
						.css(secondary);
				});
			}
			else {
				// it won't get fired otherwise
				opt.queue = false;
			}

			// fire up DOM based animations
			if (!_isEmptyObject(domProperties)) {
				callbackQueue++;
				originalAnimateMethod.apply(self, [domProperties, {
					duration: opt.duration,
					easing: jQuery.easing[opt.easing] ? opt.easing : (jQuery.easing.swing ? 'swing' : 'linear'),
					complete: propertyCallback,
					queue: opt.queue
				}]);
			}

			// strict JS compliance
			return true;
		});
	};

    jQuery.fn.animate.defaults = {};
	
	jQuery.fn.rotate = function(a) {
		var angle = parseFloat(a)||0;
		
		this.each(function() {
			var self = jQuery(this);
			var css = {};
			var transform = new Transform(self).set('rotateZ', angle).getCssFormat();
			
			for (var i = cssPrefixes.length - 1; i >= 0; i--) {
				css[cssPrefixes[i]+'transform'] = transform;
			}
			
			self.css(css);
		});	
		
		return this;
	};
	
	var calculEase = function(curb, t){
		var easings = {
			// defaults
			'linear'            : [0.250, 0.250, 0.750, 0.750],
			'ease'              : [0.250, 0.100, 0.250, 1.000],
			'easeIn'            : [0.420, 0.000, 1.000, 1.000],
			'easeOut'           : [0.000, 0.000, 0.580, 1.000],
			'easeInOut'         : [0.000, 0.000, 0.580, 1.000],
			// Penner equations
			'easeInCubic'       : [.55,.055,.675,.19],
			'easeOutCubic'      : [.215,.61,.355,1],
			'easeInOutCubic'    : [.645,.045,.355,1],
			'easeInCirc'        : [.6,.04,.98,.335],
			'easeOutCirc'       : [.075,.82,.165,1],
			'easeInOutCirc'     : [.785,.135,.15,.86],
			'easeInExpo'        : [.95,.05,.795,.035],
			'easeOutExpo'       : [.19,1,.22,1],
			'easeInOutExpo'     : [1,0,0,1],
			'easeInQuad'        : [.55,.085,.68,.53],
			'easeOutQuad'       : [.25,.46,.45,.94],
			'easeInOutQuad'     : [.455,.03,.515,.955],
			'easeInQuart'       : [.895,.03,.685,.22],
			'easeOutQuart'      : [.165,.84,.44,1],
			'easeInOutQuart'    : [.77,0,.175,1],
			'easeInQuint'       : [.755,.05,.855,.06],
			'easeOutQuint'      : [.23,1,.32,1],
			'easeInOutQuint'    : [.86,0,.07,1],
			'easeInSine'        : [.47,0,.745,.715],
			'easeOutSine'       : [.39,.575,.565,1],
			'easeInOutSine'     : [.445,.05,.55,.95],
			'easeInBack'        : [.6,-.28,.735,.045],
			'easeOutBack'       : [.175, .885,.32,1.275],
			'easeInOutBack'     : [.68,-.55,.265,1.55]
		};
		
		var curb = [].concat([0,0], easings[curb]||easings['ease'], [1,1]);
		if(t<0) t=0;
		if(t>1) t=1;
		
		var x = Math.pow(1-t, 3)*curb[0] + 3*t*Math.pow(1-t, 2)*curb[2] + 3*Math.pow(t,2)*(1-t)*curb[4] + Math.pow(t, 3)*curb[6];
		var y = Math.pow(1-t, 3)*curb[1] + 3*t*Math.pow(1-t, 2)*curb[3] + 3*Math.pow(t,2)*(1-t)*curb[5] + Math.pow(t, 3)*curb[7];
		
		return {x:x, y:y};
	};
	
	jQuery.fn.getAnimPos = function(){
		var self = jQuery(this),
			selfCSSData = self.data(DATA_KEY);

		var pos = {
			top: (parseInt(self.css('top'))||0),
			left: (parseInt(self.css('left'))||0)
		};
		
		if (selfCSSData && !_isEmptyObject(selfCSSData)) {
			var	pauseData = selfCSSData.pause,
				transform = pauseData.transform,
				time = pauseData.duration,
				timePause = new Date().getTime(),
				posTime = timePause-pauseData.timestamp,
				ratio = calculEase(pauseData.easing, posTime/time).y*100;

			// transform set
			if(!$.isEmptyObject(transform)){
				var original = $.extend({}, pauseData.original);
				var trans = new Transform(original);

				// translate
				if(transform.translateX || transform.translateY || transform.translateZ){
					trans.translate(transform.translateX/100*ratio, 
									transform.translateY/100*ratio, 
									transform.translateZ/100*ratio);
				}

				trans = trans.get(true);
				
				return { 
					top: pos.top + trans.translateY,
					left: pos.left + trans.translateX
				};
			}
		}
		return pos;
	};
	
	/**
		@public
		@name jQuery.fn.pause
		@function
		@description The enhanced jQuery.pause function
	*/
	jQuery.fn.pause = function(stop) { 
		this.each(function() {
			var self = jQuery(this),
				selfCSSData = self.data(DATA_KEY);
			
			if (selfCSSData && !_isEmptyObject(selfCSSData)) {
				
				var	pauseData = selfCSSData.pause,
					transform = pauseData.transform,
					property = pauseData.property,
					time = pauseData.duration,
					timePause = new Date().getTime(),
					posTime = timePause-pauseData.timestamp,
					selfCSSUpdate = {},
					ratio = calculEase(pauseData.easing, posTime/time).y*100;
					//ratio = posTime/time*100;
				
				if(!$.isEmptyObject(property)){
					var val = null;

					for(var key in property){
						// not original value
						if(key.indexOf('_o') == -1){
							val = new Range(
								{min: 0, max: time}, 
								{min: property[key+'_o'], max: property[key]})
							.getOutput(posTime);
							
							selfCSSUpdate[key] = val;
						}
					}
				}
				
				// transform set
				if(!$.isEmptyObject(transform)){
					var original = $.extend({}, pauseData.original);
					var trans = new Transform(original);
					
					// translate
					if(transform.translateX || transform.translateY || transform.translateZ){
						trans.translate(transform.translateX/100*ratio, 
										transform.translateY/100*ratio, 
										transform.translateZ/100*ratio);
					}

					// rotate
					if(transform.rotate){
						trans.rotate(trans.get().rotateZ+transform.rotate/100*ratio);
					}

					// scale
					if(transform.scale){
						trans.scale(new Range(
							{min: 0, max: time}, 
							{min: 1, max: transform.scale})
						.getOutput(posTime));
					}

					trans = trans.getCssFormat();

					for (var i = cssPrefixes.length - 1; i >= 0; i--) {
						selfCSSData.properties[cssPrefixes[i]+'transition-duration'] = time-posTime+'ms';
						//if(!stop)
							selfCSSUpdate[cssPrefixes[i]+'transform'] = trans;
					}
					
					pauseData.update = trans;
				}
				
				pauseData.timePause = timePause;
				pauseData.actif = true;
				
				self.css(selfCSSData.original);
				self.css(selfCSSUpdate);
			}
		});
		
		return this;
	};

	/**
		@public
		@name jQuery.fn.play
		@function
		@description The enhanced jQuery.play function
	*/
	jQuery.fn.play = function() {
		this.each(function() {
			var self = jQuery(this),
				selfCSSData = self.data(DATA_KEY);
			
			if (selfCSSData && !_isEmptyObject(selfCSSData) && selfCSSData.pause.actif) {
			
				// update timestamp
				selfCSSData.pause.timestamp += new Date().getTime()-selfCSSData.pause.timePause;
				selfCSSData.pause.actif = false;
				
				// reset transformation
				var reset = {};
				for (var i = cssPrefixes.length - 1; i >= 0; i--) {
					reset[cssPrefixes[i]+'transform'] = '';
				}
				
				self.css(reset)
					.css(selfCSSData.properties);

				setTimeout(function(){
					self.css(selfCSSData.secondary);
				});	
			}
		});
		return this;
	};
	
	/**
		@public
		@name jQuery.fn.stop
		@function
		@description The enhanced jQuery.stop function (resets transforms to left/top)
		@param {boolean} [clearQueue]
		@param {boolean} [gotoEnd]
		@param {boolean} [leaveTransforms] Leave transforms/translations as they are? Default: false (reset translations to calculated explicit left/top props)
	*/
	jQuery.fn.stop = function(clearQueue, gotoEnd, leaveTransforms) {
		//if (!cssTransitionsSupported) return originalStopMethod.apply(this, [clearQueue, gotoEnd]);

		// clear the queue?
		//if (clearQueue) this.queue([]);
		
		this.each(function() {
			var self = jQuery(this),
				selfCSSData = self.data(DATA_KEY);
		
			if(self.data('queue-stop'))
				return;
			
			// reset queue
			self.data('queue', null);
			self.data('queue-state', 0);
			self.data('anim', {top: parseInt(self.css('top')), left: parseInt(self.css('left'))});
			
			if (selfCSSData && !_isEmptyObject(selfCSSData)) {
				
				self.data('queue-stop', true)
					.unbind(transitionEndEvent)
					.removeClass('in-transition');
				
				if(!selfCSSData.pause.actif)
					self.pause(true);
				
				var transition = {};
				for (var i = cssPrefixes.length - 1; i >= 0; i--) {
					transition[cssPrefixes[i]+'transition-duration'] = '0s';
				}
				
				setTimeout(function(){
					self.css(transition);
				}, 30);
				
				if(gotoEnd){
					// reset transformation
					var reset = {};
					for (var i = cssPrefixes.length - 1; i >= 0; i--) {
						reset[cssPrefixes[i]+'transform'] = '';
					}

					self.css(reset)
					
					setTimeout(function(){
						self.css(selfCSSData.secondary);
					}, 70);	
				}
				else if(!leaveTransforms){
					var original = selfCSSData.pause.original;
					var translate = new Transform(selfCSSData.pause.update);
					var getTranslate = {x: translate.get().translateX, y: translate.get().translateY};
					
					// clear translate
					if(getTranslate.x || getTranslate.y){
						getTranslate.x -= original.translateX;
						getTranslate.y -= original.translateY;
						
						translate = translate.set('translateX', original.translateX)
											.set('translateY', original.translateY)
											.getCssFormat();

						var cssTransform = {};
						for (var i = cssPrefixes.length - 1; i >= 0; i--) {
							cssTransform[cssPrefixes[i]+'transform'] = translate;
						}

						cssTransform['left'] = parseInt(self.css('left'))+(getTranslate.x||0);
						cssTransform['top'] = parseInt(self.css('top'))+(getTranslate.y||0);
						
						self.data('anim', {top: cssTransform['top'], left: cssTransform['left']});
						
						setTimeout(function(){
							self.css(cssTransform);
						}, 70);
					}
				}
				
				setTimeout(function(){
					self.data('queue-stop', false);
					self.data(DATA_KEY, '');
					nextQueue(self);
				}, 100);
			}
		});

		return this;
	};
	
	/** 
	 * Return value between input and output
	 * @constructor
	 * @param {Object.<min,max>} input data
	 * @param {Object.<min,max>} output data
	 * @param {Boolean} [lim=true] limit
	 */
	var Range = function(input, output, lim){

		var   inp = input
			, out = output
			, lim = lim===false? false:true
		;

		inp.ampl = Math.abs(inp.max-inp.min)
		out.ampl = Math.abs(out.max-out.min);

		/**
		* convert inp>out
		* @param {Number} o input value
		* @returns {Number} output value
		*/
		this.getOutput = function(o){

			if(lim){
				var min = Math.min(inp.min, inp.max);
				var max = Math.max(inp.min, inp.max);
				if(o>=max || o<=min){
					o = (o>=max)? max: min; 
				}
			}
			return calcul(o, 'inp');
		};

		/**
		* convert out>inp
		* @param {Number} o output value
		* @returns {Number} input value
		*/
		this.getInput = function(o){

			if(lim){
				var min = Math.min(out.min, out.max);
				var max = Math.max(out.min, out.max);
				if(o>=max || o<=min){
				  o = (o>=max)? max: min; 
				}
			}
			return calcul(o, 'out');
		};


		/**
		* calcul function
		* @param {Number} o inp or out
		* @param {string} [type='inp'] 'inp' or 'out'
		* @returns {Number} inp or out
		*/
		function calcul(o, type){

			var type = type||'inp'
			  , oStart = o
			  , first = (type==='inp')? inp:out
			  , second = (type==='inp')? out:inp
			;

			// set to zero
			var oZero = oStart-first.min;
			if(first.min>0)
				oZero *= -1;
			oZero = oZero/first.ampl;

			// retransform
			var sens = (second.max>second.min)? 1:-1;
			var val = second.ampl*oZero;
			val = second.min+(val*sens);

			return val;
		}
	};
})(jQuery, jQuery.fn.animate, jQuery.fn.stop);
