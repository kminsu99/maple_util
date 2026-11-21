/* INITIALIZE */
	var LOSTARK = window.LOSTARK || {};
	if (window.INVEN && window.INVEN.Ad) { INVEN.Ad.setSite('lostark'); }
	LOSTARK.domain = 'https://lostark.inven.co.kr';

/* COMMON FUNCTIONS */
	/* Initialize */
		LOSTARK.Common = window.LOSTARK.Common || {};
	/* Protect Image */
		LOSTARK.Common.protectImage = function(obj) {
			obj.galleryImg = false;
			obj.oncontextmenu = obj.ondragstart = function() { return false; };
		};
	/* Inside Label */
		LOSTARK.Common.insideLabel = function(obj) {
			if (INVEN.Html.existClass(obj, 'null')) {
				var tempValue = obj.value;
				obj.value = '';
				obj.className = 'text';
				obj.onfocusout = function() {
					if (obj.value == '') {
						obj.value = tempValue;
						obj.className = 'text null';
					}
				};
			}
		};
	/* Open Window */
		LOSTARK.Common.openCommon = function(url, condition, target) {
			if (!target) { target = 'popup'; }
			var option = 'clear';
			var link = INVEN.QueryMaker.getLink(url, condition, option);
			INVEN.Location.openWin(link, target, "scrollbars=yes,width=700,height=860,left=20,top=20");
		};

/* DATANINFO */
	/* Initialize */
		LOSTARK.Db = window.LOSTARK.Db || {};
		LOSTARK.Db.domain = 'https://lostark.inven.co.kr';
	/* Common Functions */
		/* List */
			LOSTARK.Db.listCommon = function(page, condition, target, datagroup) {
				if (!target) { target = ''; }
				var option = '';
				if (!datagroup) {
					option = 'leave->datagroup';
				} else {
					if (condition.constructor == Array) {
						condition.datagroup = datagroup;
					} else {
						condition += ',datagroup->' + datagroup;
					}
					option = 'clear';
				}
				var url = LOSTARK.Db.domain + '/dataninfo/' + page + '/list.php';
				var link = INVEN.QueryMaker.getLink(url, condition, option);
				INVEN.Location.openWin(link, target, "scrollbars=yes");
			};
		/* Detail */
			LOSTARK.Db.viewCommon = function(page, code, target) {
				if (!target) { target = ''; }
				var url = LOSTARK.Db.domain + '/dataninfo/' + page + '/detail.php';
				var condition = {
					'code': code
				};
				var link = INVEN.QueryMaker.getLink(url, condition, 'clear');
				INVEN.Location.openWin(link, target, "scrollbars=yes");
			};
		/* Search */
			LOSTARK.Db.searchCommon = function(page, formControl, checkFormField) {
				if (formControl.checkForm(checkFormField)) {
					var formValues = formControl.getValues();
					LOSTARK.Db.listCommon(page, formValues);
				}
			};
		/* Filter */
			LOSTARK.Db.filterCommon = function(condition) {
				var link = INVEN.QueryMaker.getLink('', condition);
				INVEN.Location.openWin(link, '', "scrollbars=yes");
			};
		/* Item Layer */
			if (INVEN.Db && INVEN.Db.Tooltip) {
				LOSTARK.Db.ItemLayer = INVEN.Db.Tooltip.create('lostarkDbItemLayer', 'lostarkDbItemLayers', 'lostark', 'dataninfo/item/item_layer.ctl.php');
				LOSTARK.Db.SkillLayer = INVEN.Db.Tooltip.create('lostarkDbSkillLayer', 'lostarkDbSkillLayers', 'lostark', 'dataninfo/skill/ajax.php');
				LOSTARK.Db.TripodLayer = INVEN.Db.Tooltip.create('lostarkDbTripodLayer', 'lostarkDbTripodLayers', 'lostark', 'dataninfo/skill/ajax.php?type=tripod');
				LOSTARK.Db.SimulSkillLayer = INVEN.Db.Tooltip.create('lostarkDbSimulSkillLayer', 'lostarkDbSimulSkillLayers', 'lostark', 'dataninfo/simulator/list_ajax.php?mode=skill');
				LOSTARK.Db.SimulTripodLayer = INVEN.Db.Tooltip.create('lostarkDbSimulTripodLayer', 'lostarkDbSimulTripodLayers', 'lostark', 'dataninfo/simulator/list_ajax.php?mode=tripod');
				LOSTARK.Db.SimulRuneLayer = INVEN.Db.Tooltip.create('lostarkDbSimulRuneLayer', 'lostarkDbSimulRuneLayer', 'lostark', 'dataninfo/simulator/list_ajax.php?mode=rune');
				LOSTARK.Db.LifeskillLayer = INVEN.Db.Tooltip.create('lostarkDbLifeskillLayer', 'lostarkDbLifeskillLayers', 'lostark', 'dataninfo/lifeskill/lifeskill_layer.ctl.php');
				LOSTARK.Db.CardLayer = INVEN.Db.Tooltip.create('lostarkDbCardLayer', 'lostarkDbCardLayers', 'lostark', 'dataninfo/card/index.php?mode=tooltip');
			}

	/* Common Layer */
		LOSTARK.CommonLayer = window.LOSTARK.CommonLayer || {};
		LOSTARK.CommonLayer.create = function() {
			var temp = new LOSTARK.CommonLayer.object();
			return temp;
		};

		LOSTARK.CommonLayer.object = function() {
			var layerObj = null;
			var layerObjName = null;
			var initialized = false;
			function init() {
				if (!layerObj && layerObjName) {
					layerObj = getObj(layerObjName);
					if (!layerObj) {
						layerObj = document.createElement("DIV");
						layerObj.id = layerObjName;
						document.body.appendChild(layerObj);
					}
					initialized = true;
				}
			}
			this.setLayerObj = function(obj) {
				layerObj = getObj(obj);
				if (!layerObj) {
					layerObjName = obj;
					addEvent(window, 'onload', init);
				}
			};
			this.showText = function(text) {
				if ((!initialized) || (!layerObj)) { return; }
				layerObj.innerHTML = text;
				show();
			};
			function show() {
				if ((!initialized) || (!layerObj)) { return; }
				INVEN.Layer.show(layerObj, 10, 10);
			}
			this.show = show;
			this.hide = function() {
				if ((!initialized) || (!layerObj)) { return; }
				INVEN.Layer.hide(layerObj);
			};
			addEvent(window, 'onload', init);
		};
		LOSTARK.CommonLayer.defaultObject = LOSTARK.CommonLayer.create();
		LOSTARK.CommonLayer.defaultObject.setLayerObj('LOSTARKCommonLayer');
		LOSTARK.CommonLayer.show = function() { LOSTARK.CommonLayer.defaultObject.show(); };
		LOSTARK.CommonLayer.showText = function(text) { LOSTARK.CommonLayer.defaultObject.showText(text); };
		LOSTARK.CommonLayer.hide = function() { LOSTARK.CommonLayer.defaultObject.hide(); };

/* RIGHTMENU */
	/* Initialize */
		LOSTARK.Rightmenu = window.LOSTARK.Rightmenu || {};
	/* ExpendMenu */
		LOSTARK.Rightmenu.expendMenu = function(obj) {
			obj = getObj(obj);
			var expendObj = INVEN.Html.getParentByTagName(obj, 'div');
			if (INVEN.Html.existClass(expendObj, 'menuItem-Open')) {
				INVEN.Html.replaceClass(expendObj, 'menuItem-Open', 'menuItem-Close');
			} else {
				INVEN.Html.replaceClass(expendObj, 'menuItem-Close', 'menuItem-Open');
			}
			obj.blur();
		};
	/* Open Search */
		LOSTARK.Rightmenu.openSearch = function(obj) {
			var formObj = getObj(obj);
			if (formObj.sw.value.replace(/ /g,"") < 1) {
				alert('검색어를 입력해주세요.');
			} else {
				window.open("https://www.inven.co.kr/webzine/intsearch/index.php?sw="+encodeURIComponent(formObj.sw.value)+"&sname=lostark", "_blank", "width=740px, height=800px, toolbar=no, menubar=no, scrollbars=yes, resizable=no, copyhistory=no" );
			}
		};

	/* 좌측 메뉴 */
	var LOSTARK = window.LOSTARK || {};
	LOSTARK.Mod = window.LOSTARK.Mod || {};
	LOSTARK.Mod.searchModule = function(obj) {
		var searchModule = obj.searchModule;
		if (searchModule.value.replace(/ /g,"") < 1) {
			alert('검색어를 입력해주세요.');
			return false;
		}
		INVEN.Location.openWin('https://lostark.game.onstove.com/Profile/Character/' + encodeURIComponent(searchModule.value), '_blank', "scrollbars=yes");
	};
	LOSTARK.Mod.searchModule2 = function(obj) {
		var searchModule = obj.searchModule;
		if (searchModule.value.replace(/ /g,"") < 1) {
			alert('검색어를 입력해주세요.');
			return false;
		}
		var link = INVEN.QueryMaker.getLink(LOSTARK.domain +'/dataninfo/item/', 'searchword->' + searchModule.value, 'clear');
		INVEN.Location.openWin(link, '_self', "");
	};
	LOSTARK.Mod.searchModule3 = function(obj) {
		var searchModule = obj.searchModule;
		if (searchModule.value.replace(/ /g,"") < 1) {
			alert('검색어를 입력해주세요.');
			return false;
		}
		var link = INVEN.QueryMaker.getLink(LOSTARK.domain +'/dataninfo/crew/', 's_name->' + searchModule.value, 'clear');
		INVEN.Location.openWin(link, '_self', "scrollbars=yes");
	};
	LOSTARK.Mod.searchMap = function(mod, input) {
		if (!('InputUtil' in INVEN)) return;
		var form = input.form;
		form.method = 'GET';
		form.action = '//lostark.inven.co.kr/dataninfo/' + mod + '/';
		//form.target = '_BLANK';
		if ((mod == 'world' && input.name == 'code') || (mod == 'map' && input.name == 'island')) {
			var submit = function(result) {
				if ($.isPlainObject(result) && input.name in result) {
					if (typeof(form.target) == 'string' && form.target.toLowerCase() == '_blank') {
						var f = document.createElement('FORM');
						f.method = form.method;
						f.action = form.action;
						f.target = form.target;
						var i = document.createElement('INPUT');
						i.type = input.type;
						i.name = input.name;
						i.value = result[input.name];
						f.appendChild(i);
						document.body.appendChild(f);
						f.submit();
						document.body.removeChild(f);
					} else {
						document.location.href = form.action + '?' + encodeURIComponent(input.name) + '=' + encodeURIComponent(result[input.name]);
					}
				}
			};
			form.onsubmit = function() {
				if ($.trim(input.value).length == 0) {
					alert('검색어를 입력해주세요.');
					input.focus();
				} else {
					var result = INVEN.InputUtil.getValue(input);
					if (result) submit(result);
				}
				return false;
			};
			INVEN.InputUtil.autocomplete(input, form.action + 'autocomplete.ajax.php', submit);
		} else {
			form.onsubmit = function() {
				if ($.trim(input.value).length > 0) {
					return true;
				} else {
					alert('검색어를 입력해주세요.');
					input.focus();
					return false;
				}
			};
			$(input).on('keydown', function(e) {
				if (e.key == 'Enter') {
					e.preventDefault();
					form.submit();
					return false;
				}
			});
		}
	};

