jQuery.Animated-Enhanced Alter version
===========================

Fork of __[animate enhanced](https://github.com/benbarnett/jQuery-Animate-Enhanced)__. Work in progress, not stable version.

Use __[Transform Css](https://github.com/flavienliger/Transform-Css)__ for convert parameter.

Features Adding
=============

- property supported :
```js
$('.anim').animate({
	left: 500, 
	top: 100, 
	rotate: 90, 		// add rotate
	opacity: 0.5, 
	width: 50, 
	scale:0.5 		// add scale x/y
}, 5000, 'linear');
```

- time management :
```js
$('.anim').pause();		// pause
$('.anim').play();  		// play
$('.anim').stop();		// stop and set top/left
```
- rework chainage :
```js
$('.anim').fadeIn().fadeOut();
```
- extend function :
```js
$('.anim').rotate(90); 		// rotate
$('.anim').getAnimPos();	// return pos left/top	
```
- fix callback in multi-object :
```js
$('.anim').animate({ left: 100 }, function(){
	$(this).fadeOut();
});
```	
- fix double same animate (in original version, transition failed) :
```js
$('.anim').fadeOut();
$('.anim').fadeOut(); // fix them - return false
```

Support
=======

- Safari
- Android 4+
- Firefox
- Chrome

Slight delay in stop/play, for supported Android < 4.4.


Features unstable or remove
=============

- right / bottom
- -= in translate
- traditionnal animate
- pause easing
