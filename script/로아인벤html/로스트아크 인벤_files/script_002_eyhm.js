var movelink = function(ele) {
	var addr = ele.value;
	window.location = addr;
}
var svgDefsLoaded = function(data){
	data.documentElement.setAttribute('style', 'display:none');
	window.svgdata = document.importNode(data.documentElement, true);
	$(function() {
		$(window.svgdata).prependTo('body');
		$('.section.title .head_title div.more[data-svg-id]').each(function(){
			var _this = $(this);
			var fill_color = null;
			_this.html('<svg viewBox="0 0 32 6"><use width="32px" height="6px" href="' + _this.attr('data-svg-id') + '"' + ((fill_color=_this.attr('data-svg-fill'))?' fill="' + fill_color + '"':'') + '/></svg>');
			_this.addClass('svg');
		});
	});
};
var svgDefsError = function(data){
	console.log(data);
};
$.ajax({
	'url': '//static.inven.co.kr/image_2011/ibuilder/icon/icon_more.svg?v=180731a',
	'dataType': 'xml',
	'success': svgDefsLoaded,
	'error': svgDefsError,
});
