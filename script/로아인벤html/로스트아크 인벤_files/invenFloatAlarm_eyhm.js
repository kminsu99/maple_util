jQuery(function($) {
	function localStorageApi() {
		const userAgent = navigator.userAgent.toLowerCase();
		const isSafari = userAgent.indexOf('safari') > -1 && userAgent.indexOf('chrome') === -1;
		const iosInvenApp = userAgent.includes('kr.co.invenapp') && (userAgent.includes('iphone') || userAgent.includes('ipad'));
		if (!localStorageApi.getApi) {
			var api = {guarantee : $.noop, getItem : $.noop, setItem : $.noop, removeItem : $.noop};
			var apiDfd = $.Deferred();
			if (isSafari || iosInvenApp) {
				var makeApi = function(isGuarantee) {
					var newApi = {},
						resultStack = [],
						then = function(resolve, reject) {
							resolve = $.isFunction(resolve) ? resolve : $.noop;
							var length = resultStack.length;
							var res = resolve(length ? resultStack[length - 1] : undefined);
							if (typeof res != 'undefined' && isGuarantee === true && length == resultStack.length) {
								resultStack.push(res);
							}

							return this;
						};
					if (isGuarantee === true) {
						newApi.then = then;
					}
					for (var method in api) {
						switch (method) {
							case 'getItem':
								newApi.getItem = function (key) {
									resultStack = [key ? decodeURIComponent(getCookie(key)) : null];

									return (isGuarantee === true) ? this : {then : then};
								}
								break;

							case 'setItem':
								newApi.setItem = function (key, data) {
									resultStack = [key ? setCookie(key, data, 'infinite') : null];

									return (isGuarantee === true) ? this : {then : then};
								}
								break;

							case 'removeItem':
								newApi.removeItem = function(key) {
									resultStack = [key ? setCookie(key, '') : null];

									return (isGuarantee === true) ? this : {then : then};
								}
								break;
						}
					}

					return newApi;
				};
				api = makeApi(false);
				api.guarantee = function() {
					return makeApi(true);
				};
				apiDfd.resolve(api);
			} else {
				var isCrossDomainSetting = document.domain == 'inven.co.kr';
				var targetOrigin = 'https://www.inven.co.kr';
				var iframeDfd = $.Deferred();
				var requestStack = {};
				if (isCrossDomainSetting) {
					var makeApi = function(localStorage, isGuarantee) {
						var newApi = {},
							resultStack = [],
							then = function(resolve, reject) {
								resolve = $.isFunction(resolve) ? resolve : $.noop;
								var length = resultStack.length;
								var res = resolve(length ? resultStack[length - 1] : undefined);
								if (typeof res != 'undefined' && isGuarantee === true && length == resultStack.length) {
									resultStack.push(res);
								}

								return this;
							};
						if (isGuarantee === true) {
							newApi.then = then;
						}
						for (var method in api) {
							(function(method) {
								if (method != 'guarantee') {
									if (method == 'setItem') {
										newApi.setItem = function (key, data) {
											resultStack = [key ? localStorage.setItem(key, data) : null];

											return (isGuarantee === true) ? this : {then : then};
										};
									} else {
										newApi[method] = function (key) {
											resultStack = [key ? localStorage[method](key) : null];

											return (isGuarantee === true) ? this : {then : then};
										};
									}
								}
							})(method);
						}

						return newApi;
					};
					iframeDfd.done(function(iframe) {
						var localStorage = iframe.contentWindow.localStorage;
						api = makeApi(localStorage);
						api.guarantee = function() {
							return makeApi(localStorage, true);
						};
						apiDfd.resolve(api);
					});
				} else {
					var targetIframe = null;
					var request = function(method, key, data) {
						return $.Deferred(function(dfd) {
							iframeDfd.done(function(iframe) {
								var timeoutID = setTimeout(function(e) {
									if (dfd.state() == 'pending') {
										dfd.reject('timeout');
									}
									delete requestStack[timeoutID];
								}, 1500);
								iframe.contentWindow.postMessage({
									id : timeoutID, method : method, key : key, payload : data
								}, targetOrigin);
								requestStack[timeoutID] = dfd;
							}).fail(function(reason) {
								dfd.reject(reason);
							});
						}).promise();
					};
					api = {
						guarantee : function(ignoreReject) {
							var stack = [];
							var thenStack = [];
							var isThenable = false;
							var saveStack = function(obj) {
								if (isThenable === true) {
									thenStack.push(obj);
								} else {
									stack.push(obj);
								}
							};
							var currentDFD = $.Deferred().resolve();
							var chain = function(prevDFD) {
								if (!isThenable) {
									var contextStack = thenStack.length ? thenStack : stack;
									if (contextStack.length && (prevDFD || currentDFD.state() != 'pending')) {
										var obj = contextStack.shift();
										if (ignoreReject !== true && prevDFD && prevDFD.state() == 'rejected') {
											prevDFD.fail(obj.dfd.reject);
											chain(prevDFD);
										} else if (obj.method == 'then') {
											prevDFD.then(function(res) {
												isThenable = true;
												var what = obj.dfd.resolve(res);
												isThenable = false;
												chain(what ? $.Deferred().resolve(what) : prevDFD);
											}, function(reason) {
												isThenable = true;
												var what = obj.dfd.reject(reason);
												isThenable = false;
												chain(what ? $.Deferred().reject(what) : prevDFD);
											});
										} else if (obj.method != 'then') {
											currentDFD = api[obj.method].apply(null, obj.arguments).then(function(res) {
												obj.dfd.resolve(res);
												chain(obj.dfd);
											}, function(reason) {
												obj.dfd.reject(reason);
												chain(obj.dfd);
											});
										}
									} else if (currentDFD.state() != 'pending' && (thenStack.length || stack.length)) {
										chain(prevDFD);
									}
								}
							};

							return {
								then : function(resolve, reject) {
									saveStack({
										dfd : {
											resolve : resolve || $.noop,
											reject : reject || $.noop,
										},
										method : 'then',
										arguments : arguments
									});

									return this;
								},
								getItem : function(key) {
									var dfd = $.Deferred();
									saveStack({
										dfd : dfd,
										method : 'getItem',
										arguments : arguments
									});
									chain();

									return this;
								},
								setItem : function(key, data) {
									var dfd = $.Deferred();
									saveStack({
										dfd : dfd,
										method : 'setItem',
										arguments : arguments
									});
									chain();

									return this;
								},
								removeItem : function(key) {
									var dfd = $.Deferred();
									saveStack({
										dfd : dfd,
										method : 'removeItem',
										arguments : arguments
									});
									chain();

									return this;
								}
							}
						},
						getItem : function(key) {
							return request('getItem', key, null);
						},
						setItem : function(key, data) {
							return request('setItem', key, data);
						},
						removeItem : function(key) {
							return request('removeItem', key, null);
						}
					};
					$(window).on('message', function(e) {
						if (e.originalEvent.origin == targetOrigin && e.originalEvent.source === targetIframe.contentWindow) {
							var data = e.originalEvent.data;
							if (data.id in requestStack) {
								if (data.result === true) {
									requestStack[data.id].resolve(data.payload);
								} else {
									requestStack[data.id].reject(data.reason);
								}
							}
						}
					});
					apiDfd.resolve(api);
				}

				targetIframe = $('<iframe/>', {
					id : 'local-storage-api',
					src : 'https://www.inven.co.kr/common/module/floatalarm/communication.php' + (isCrossDomainSetting ? '?no_cross_domain=1' : ''),
					style : 'position:absolute;z-index:-1;left:-1px;top:-1px;height:0;width:0;border:0;border:none;visibility:hidden;'
				}).on('load', function(e) {
					iframeDfd.resolve(this);
				}).appendTo(document.body).get(0);

				setTimeout(function() {
					iframeDfd.reject('iframe loading error');
				}, 5000);
			}

			localStorageApi.getApi = function(fn) {
				apiDfd.done(fn);
			};
		}

		return localStorageApi.getApi;
	}
	function makePlayer(config) {
		let html = '';
		const [twitch_url, youtube_url] = config.streaming_url.split('|');
		html = `<a href="${config.link}" target="${config.link_target}" class="player-thumb" style="background-image:url('${config.thumbnail}');"></a>`;
		if (html) {
			html += '<div class="player-link">';
			if (youtube_url) {
				html += `<a class="youtube" href="${youtube_url}" target="_blank">youtube</a>`;
			}
			if (twitch_url) {
				html += `<a class="twitch" href="${twitch_url}" target="_blank">twitch</a>`;
			}
			html += '</div>';
		}
		return html;
	}
	var $invenSite = $('meta[name="inven-site"]'),
		data = {site : $invenSite.length ? $invenSite.attr('content') : ''},
		storageKey = 'floatalarm_closed';
	var getApi = localStorageApi();
	var checkSite = ['', 'www', 'inven', 'mini', 'dataninfo', 'game', 'm', 'common'], step = 0;

	while (checkSite.indexOf(data.site) !== -1 && step < 3) {
		data.site = '';
		switch (step++) {
			case 0:
				data.site = location.hostname.split('.')[0];
				break;

			case 1:
				var splitPathname = location.pathname.split('/');
				if (splitPathname.length) {
					if (splitPathname[1] == 'board' || splitPathname[1] == 'search') {
						data.site = splitPathname[2];
					} else if (splitPathname[1] != 'webzine') {
						data.site = splitPathname[1];
					}
					if (data.site.indexOf('.') !== -1) {
						data.site = '';
					}
				}
				break;

			case 2:
				var $invenMobile = $('.invenMobile');
				if ($invenMobile.length) {
					var matches = $invenMobile.attr('href').match(/\/(\w+)$/);
					data.site = matches ? matches[1] : '';
				}
				break;
		}
	}

	data.referer = '';
	if (location.origin !== 'https://www.inven.co.kr') {
		data.referer = location.origin + location.pathname + (/\/$/.test(location.pathname) ? '' : '/');
	}

	getApi(function(storageApi) {
		storageApi.getItem(storageKey).then(function(floatalarms) {
			$.ajax('https://www.inven.co.kr/common/module/floatalarm/list.ajax.php', {
				data : data,
				xhrFields: {
					withCredentials: true
				},
				success : function(res) {
					var storageApiGuarantee = storageApi.guarantee();
					var dataConverter = function(data) {
						if (typeof data == 'string') {
							data = data.split('-').map(function(item) {
								return item.split('.').map(Number);
							});
							data = (data.length == 2) ? data : [[], []];

							return {idx : data[0], time : data[1]};
						} else if ($.isPlainObject(data)) {
							return [data.idx, data.time].map(function(item) {
								return item.join('.');
							}).join('-');
						}

						return '';
					};
					floatalarms = dataConverter(floatalarms || '');
					if (floatalarms && floatalarms.idx.length && res.possible_idx) {
						for (var i = floatalarms.idx.length - 1; i >= 0; i--) {
							if (res.possible_idx.indexOf(floatalarms.idx[i]) === -1) {
								floatalarms.idx.splice(i, 1);
								floatalarms.time.splice(i, 1);
							}
						}
					}

					if ((res.list && res.output_cnt) || !$.isEmptyObject(res.service_list)) {
						function hexToRgb(hex) {
							var shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
							hex = hex.replace(shorthandRegex, function(m, r, g, b) {
								return r + r + g + g + b + b;
							});

							var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
							return result ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)] : [];
						}
						var now = Date.now(),
							isIE = document.documentMode,
							$widthSpan = isIE ? $('<span/>', {style : 'position:absolute;left:0;top:0;visibility:hidden;opacity:0;z-index:-1;width:218px;word-wrap:break-word;word-break:break-word;font-size:12px;font-family:굴림,gulim;'}).appendTo(document.body) : $(),
							isMobile = document.documentElement.classList.contains('mobile') ||  location.host.split('.')[0] == 'm',
							canPlay = !isIE && !isMobile && window.innerWidth > 1024,
							html = '',
							groups = [
								{first : [], random : []},
								{first : [], random : []},
								{first : [], random : []},
								{first : [], random : []},
							],
							alarms = [];
						res.list.filter(function(alarm) {
							var start = alarm.start.match(/\d+/g), end = alarm.end.match(/\d+/g);
							if (now < (new Date(start[0], Number(start[1]) - 1, start[2], start[3], start[4], start[5])).getTime()
								|| now > (new Date(end[0], Number(end[1]) - 1, end[2], end[3], end[4], end[5])).getTime()) {
								return false;
							}
							var closed = floatalarms.idx.indexOf(alarm.idx);
							if (closed !== -1 && floatalarms.time[closed]) {
								if (alarm.reopen_min == 0 || alarm.reopen_min > Math.round((now - floatalarms.time[closed]) / 1000 / 60)) {
									return false;
								} else {
									floatalarms.idx.splice(closed, 1);
									floatalarms.time.splice(closed, 1);
								}
							}

							return true;
						}).forEach(function(alarm) {
							groups[alarm.group - 1][alarm.priority].push(alarm);
						});
						groups.forEach(function(item, idx) {
							item.first = item.first.sort(function(a, b) {
								return b.idx - a.idx;
							});
							var group = idx + 1;
							if (item.first.length < res.output_cnt[group]) {
								item.random = item.random.sort(function() {
									return 0.5 - Math.random();
								});
							}
							alarms = alarms.concat(item.first.concat(item.random).slice(0, res.output_cnt[group]));
						});

						for (var service_key in res.service_list) {
							var defaultBanner = res.service_list[service_key].default_banner,
								list = res.service_list[service_key].list,
								style = res.service_list[service_key].style;
							for (var i = 0; i < list.length; i++) {
								var alarm = JSON.parse(list[i]);
								alarms.push({
									idx : alarm.id,
									group: null,
									service_key : service_key,
									mobile_thumbnail : 'Y',
									thumbnail : alarm.banner || defaultBanner,
									link_target : alarm.target || '_self',
									link : alarm.link,
									title : alarm.title,
									text : alarm.contents,
									styles : style
								});
							}
						}

						alarms.forEach(function(config) {
							var styles = (typeof config.styles == 'string') ? config.styles.split('|') : config.styles,
								boxBG = '', boxBorder = '', title = '', msg = '', closeBG = '', closeBorder = '', closeX = '';
							if (Array.isArray(styles)) {
								for (var i = 0, length = styles.length; i < length; i++) {
									if (styles[i]) {
										switch (i) {
											case 0:
												var rgb = hexToRgb(styles[i]).join(), opacity = (styles[1] || 100) / 100;
												boxBG = 'background-color:rgba(' + rgb + ','+ opacity +');';
												closeBG = 'background-color:rgba('+ rgb +', 0.8);'
												break;

											case 2:
												boxBorder = 'border-color:' + styles[i] + ';';
												closeBorder = boxBorder;
												break;

											case 3:
												msg = 'color:' + styles[i] + ';';
												break;

											case 4:
												var rgb = hexToRgb(styles[i]).join(), opacity = (styles[5] || 100) / 100;
												closeBG = 'background-color:rgba(' + rgb + ','+ opacity +');';
												break;

											case 6:
												closeBorder = 'border-color:' + styles[i] + ';';
												break;

											case 7:
												closeX = 'background-color:' + styles[i] + ';';
												break;
										}
									}
								}
							} else if ($.isPlainObject(styles)) {
								for (var elem in styles) {
									if ($.isPlainObject(styles)) {
										for (var prop in styles[elem]) {
											var value = styles[elem][prop];
											if (prop == 'font-family') {
												value = value.replace(/"/g, "'");
											}
											switch (elem) {
												case 'title':
													title += prop + ':' + value + ';';
													break;
												case 'content':
													msg += prop + ':' + value + ';';
													break;
											}
										}
									}
								}
							}
							var hasThumb = config.thumbnail && (!isMobile || config.mobile_thumbnail == 'Y') && (config.group != 4 || !config.streaming_url || !canPlay);
							var text = config.text;
							if (isIE && (config.group != 4 || !config.streaming_url || !canPlay)) {
								var cutString = function($elem, height, node) {
									var startIndex = 1;
									if (!node) {
										if ($elem.height() <= height) {
											return $elem.html();
										}
										node = $elem.get(0);
										node.appendChild(document.createTextNode('...'));
										startIndex = 2;
									}
									node = node || $elem.get(0);
									for (var i = node.childNodes.length - startIndex; i >= 0; i--) {
										if (node.childNodes[i].nodeType == 3) {
											while (node.childNodes[i].nodeValue.length) {
												if ($elem.height() <= height) {
													return $elem.html();
												}
												node.childNodes[i].nodeValue = node.childNodes[i].nodeValue.substr(0, node.childNodes[i].nodeValue.length - 1);
											}
										} else {
											var html = cutString($elem, height, node.childNodes[i]);
											if (html) {
												return html;
											}
										}
									}
									(startIndex == 1) && node.parentNode.removeChild(node);

									return '';
								}
								text = cutString($widthSpan.html(text), 36);
							}
							if (config.group == 4 && config.thumbnail && !canPlay) {
								if (config.thumbnail.startsWith('https://static-cdn.jtvnw.net')) {
									config.thumbnail = config.thumbnail.replace('-316x180.jpg', '-140x80.jpg');
								} else if (config.thumbnail.startsWith('https://i.ytimg.com')) {
									config.thumbnail = config.thumbnail.replace('/mqdefault.jpg', '/default.jpg');
								}
							}
							html += '<li class="'+ (hasThumb ? 'has-thumb' : '') + ((config.group == 4 && config.streaming_url && canPlay) ? ' has-player' : '') +'" data-idx="'+ config.idx +'" data-service-key="'+ (config.service_key || 'normal') +'">';
							if (config.group == 4 && config.streaming_url && canPlay) {
								html += makePlayer(config);
								hasThumb = false;
								html += '<div class="move-wrap" style="'+ boxBG + boxBorder +'">';
								boxBG = boxBorder = '';
							}
							html +='<a href="'+ config.link +'" target="'+ config.link_target +'" style="'+ boxBG + boxBorder +'">';
							if (hasThumb) {
								html +=	'<div class="thumb"><img src="'+ config.thumbnail +'" alt=""></div>';
							}
							html += '<div class="msg">';
							if ('title' in config) {
								html += '<p class="title" style="'+ title +'"><strong>'+ config.title +'</strong></p>';
							}
							html += '<p style="'+ msg +'">'+ text +'</p></div>';
							html += '</a>';
							if (config.group == 4 && config.streaming_url && canPlay) {
								html += '</div>';
							}
							html += '<button class="'+ (closeBG ? '' : 'no-bg') +'" type="button" style="'+ closeBG + closeBorder +'">닫기<span style="'+ closeX +'"></span><span style="'+ closeX +'"></span></button>';
							html += '</li>';
						});
						var $invenFloatAlarm = $('<ul class="inven-float-alarm">'+ html +'</ul>');
						$invenFloatAlarm.toggleClass('roulette-open', res.roulette_open == 1);
						$(document.body).append($invenFloatAlarm);
						$invenFloatAlarm.find('a,button').click(function(e) {
							var $li = $(this).closest('li'),
								idx = Number($li.attr('data-idx')),
								now = Date.now(),
								newTabOpen = this.tagName.toLowerCase() == 'a' && this.target == '_blank',
								service_key = $li.attr('data-service-key');
							if (service_key != 'normal') {
								$.ajax('https://www.inven.co.kr/common/module/floatalarm/confirm.ajax.php', {
									data: {service_key: service_key, id: idx},
									method: 'POST',
									xhrFields: {
										withCredentials: true
									},
									success: function (res) {
										//
									}
								});
							} else {
								storageApiGuarantee.getItem(storageKey).then(function(res) {
									var find = -1, nextIndex = 0;
									res = dataConverter(res || '');
									find = res.idx.indexOf(idx);
									nextIndex = (find === -1) ? res.idx.length : find;
									res.idx[nextIndex] = idx;
									res.time[nextIndex] = now;
									storageApiGuarantee.setItem(storageKey, dataConverter(res));
								});
							}
							if (this.tagName.toLowerCase() == 'button') {
								$li.addClass('remove').on('transitionend', function(e) {
									$(this).remove();
								});
							} else if (newTabOpen) {
								$li.remove();
							}
						});
						$widthSpan.remove();
					}
					if (floatalarms.idx.length) {
						storageApiGuarantee.setItem(storageKey, dataConverter(floatalarms));
					} else {
						storageApiGuarantee.removeItem(storageKey);
					}
				}
			});
		});
	});
});