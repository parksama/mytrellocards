
var MyTrelloCards = (function() {
	'use strict';

	var default_list = [
		{name : 'To Do',         regex : 'todo|to do',                    default : true},
		{name : 'Doing',         regex : 'doing',                         default : true},
		{name : 'To Confirm',    regex : 'confirm',                       default : true},
		{name : 'To Upload',     regex : 'upload',                        default : true},
		{name : 'Sandbox Check', regex : 'sandbox.*check|check.*sandbox', default : true},
		{name : 'Live Check',    regex : 'live.*check|check.*live',       default : true},
	];

	window.engine_cache = {
		organization : {},
		board        : {},
		list         : {},
		member       : {},
		vars         : {},
	};

	window.card_cache = {};

	window.categories = generate_rule(default_list);

	var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Des'];

	var label_prio = ['red', 'orange', 'yellow', 'green', 'purple', 'black', 'blue', 'lime', 'pink', 'sky'];

	/**
	 * Batch request for Trello list, board and organization
	 * @param  {string} type       Type of items want to fetch [organizations, board, list, member]
	 * @return {object}            jQuery deferred promise
	 *
	 * @author fuad_yusuf
	 */
	function my_trello_batch(type)
	{
		var prefix      = '',
			cache       = false,
			urls        = [],
			indexid     = [],
			defer         = new $.Deferred();

		switch(type)
		{
			case 'organization':
				prefix = "/organizations/";
				cache = window.engine_cache.organization;
				break;
			case 'board':
				prefix = "/board/";
				cache = window.engine_cache.board;
				break;
			case 'list':
				prefix = "/lists/";
				cache = window.engine_cache.list;
				break;
			case 'member':
				prefix = "/members/";
				cache = window.engine_cache.member;
				break;
		}


		$.each(cache, function(id, cache_item) {
			if(!cache_item.isDone)
			{
				indexid.push(id);
				urls.push(prefix+id);
			}
		});

		if(urls.length < 1)
		{
			defer.resolve(type);
		}

		defer.notify(0);

		var parts       = array_chunk(indexid, 100, false);
		var parts_count = parts.length;
		var parts_done  = 0;

		$.each(parts, function(index, indexid_chunk) {

			var p_urls = [];
			$.each(indexid_chunk, function(index2, item_id) {
				p_urls.push(prefix+item_id);
			});

			Trello.get('batch', {
				urls: p_urls
			}, function(datas){
				$.each(datas, function(index, data) {
					var item_id = indexid_chunk[index];

					if(!!cache[item_id])
					{
						cache[item_id].isDone = true;
						if(typeof data == 'object' && !!data['200'])
						{
							cache[item_id].data = data[200];
							cache[item_id].isSuccess = true;
						}
						else
						{
							cache[item_id].data = data;
							cache[item_id].isSuccess = false;
						}
					}
				});

				setTimeout(function() {
					parts_done++;
					defer.notify(Math.floor(parts_done / parts_count * 100));
					if(parts_done >= parts_count)
					{
						defer.resolve(type);
					}
				}, 100);
			}, function(error) {
				console.log('Trello batch error', type, error);
				defer.reject(error);
			});
		});

		return defer.promise();
	}

	function get_my_cards(member_id)
	{
		var defer = new $.Deferred();

		var updateProgress = function(percent, message)
		{
			defer.notify(Math.floor(percent), message);
		};

		if('undefined' == typeof member_id || !member_id)
		{
			member_id = 'me';
		}

		updateProgress(10, 'Fetching Cards...');
		Trello.get("members/"+ member_id +"/cards", function(cards) {
			/* Prepare members, lists and boards cache */
			$.each(cards, function(index, card) {
				$.each(card.idMembers, function(i, id_member) {
					if(!engine_cache.member[id_member]) engine_cache.member[id_member] = {
						data      : false,
						isDone    : false,
						isSuccess : false,
					};
				});

				if(!engine_cache.list[card.idList]) engine_cache.list[card.idList] = {
					data      : false,
					isDone    : false,
					isSuccess : false,
				};

				if(!engine_cache.board[card.idBoard]) engine_cache.board[card.idBoard] = {
					data      : false,
					isDone    : false,
					isSuccess : false,
				};
			});

			my_trello_batch('member')
			.progress(function(p){
				updateProgress( 30 + (p / 5), 'Fetching Members...' );
			})

			.then(function() {
				return my_trello_batch('list')
				.progress(function(p){
					updateProgress( 50 + (p / 5), 'Fetching Lists...' );
				});
			})

			.then(function() {
				return my_trello_batch('board')
				.progress(function(p){
					updateProgress( 70 + (p / 5), 'Fetching Boards...' );
				});
			})

			.then(function() {
				/* Prepare organizations cache */
				$.each(window.engine_cache.board, function(idBoard, cache_item) {
					if(cache_item.data.idOrganization)
					{
						if(!engine_cache.organization[cache_item.data.idOrganization]) engine_cache.organization[cache_item.data.idOrganization] = {
							data: false,
							isDone: false,
							isSuccess: false,
						};
					}
				});

				return my_trello_batch('organization')
				.progress(function(p){
					updateProgress( 90 + (p / 10), 'Fetching Organizations...' );
				});
			})

			// .then(function() {
			// 	return get_all_org_member();
			// })

			.then(function(data) {
				updateProgress(100, 'Done!');
				defer.resolve(cards);
			});
		},
		function() {
			defer.reject();
		});

		return defer.promise();
	}

	function get_all_org_member() {
		var defer  = new $.Deferred();
		var p_urls = [];

		$.each(window.engine_cache.organization, function(index, val) {
			p_urls.push('/organizations/' + index + '/members');
		});

		Trello.get('batch', {
			urls: p_urls
		}, function(datas){
			console.log(datas);

			$.each(datas, function(index, data) {
				if(typeof data == 'object' && !!data['200'])
				{
					$.each(data['200'], function(i, member) {
						if(!engine_cache.member[member.id]) engine_cache.member[member.id] = {
							data      : false,
							isDone    : false,
							isSuccess : false,
						};
					});
				}
			});

			my_trello_batch('member')
			.done(function() {
				defer.resolve();
			});

		}, function(error) {
			console.log('Trello batch error', type, error);
			defer.reject(error);
		});

		return defer.promise();
	}

	function categorize_cards(cards) {
		$.each(cards, function(index, card) {
			var list    = window.engine_cache.list[card.idList].data;
			var board   = window.engine_cache.board[card.idBoard].data;

			/* special for Paperlust */
			if(/paperlust/i.test(board.name))
			{
				if(/operations|acquisition|sprint/i.test(list.name))
				{
					categories['To Do'].items.push(card);
					return true;
				}
			}

			/* special for Bugs & Update */
			if(/bugs and updates/i.test(board.name))
			{
				if(/bug.*low|bug.*medium|bug.*high|upcoming update|updates/i.test(list.name))
				{
					categories['To Do'].items.push(card);
					return true;
				}
			}

			$.each(categories, function(i, category) {
				if(category.regex.test(list.name))
				{
					categories[i].items.push(card);
					return false;
				}
			});
		});
	}


	/* Helper functions */
	/**
	 * Array chunk
	 * Original by Carlos R. L. Rodrigues (http://www.jsfromhell.com)
	 * Discuss at: http://phpjs.org/functions/array_chunk/
	 */
	function array_chunk(input, size, preserve_keys)
	{
		var x, p = '',
		i = 0,
		c = -1,
		l = input.length || 0,
		n = [];

		if (size < 1) {
			return null;
		}

		if (Object.prototype.toString.call(input) === '[object Array]') {
			if (preserve_keys) {
				while (i < l) {
					(x = i % size) ? n[c][i] = input[i] : n[++c] = {}, n[c][i] = input[i];
					i++;
				}
			} else {
				while (i < l) {
					(x = i % size) ? n[c][x] = input[i] : n[++c] = [input[i]];
					i++;
				}
			}
		} else {
			if (preserve_keys) {
				for (p in input) {
					if (input.hasOwnProperty(p)) {
						(x = i % size) ? n[c][p] = input[p] : n[++c] = {}, n[c][p] = input[p];
						i++;
					}
				}
			} else {
				for (p in input) {
					if (input.hasOwnProperty(p)) {
						(x = i % size) ? n[c][x] = input[p] : n[++c] = [input[p]];
						i++;
					}
				}
			}
		}
		return n;
	}

	function due_class(due) {
		var due_date   = new Date(due);
		var now        = new Date();
		var hour       = (due_date - now) / (1000 * 60 * 60);
		var class_name = '';

		if(hour >= 24)
		{
			class_name = 'future';
		}
		else if(hour > 0)
		{
			class_name = 'soon';
		}
		else if(hour > -36)
		{
			class_name = 'now';
		}
		else
		{
			class_name = 'past';
		}

		return class_name;
	}

	function render_card(card_data, render_list_name)
	{
		var list_data    = window.engine_cache.list[card_data.idList].data;
		var board_data   = window.engine_cache.board[card_data.idBoard].data;

		var card = $('<a>', {
			'class'   :'card' + ' card-' + card_data.id + ' board-' + board_data.id,
			'href'    : card_data.url,
			'target'  : '_blank',
			'data-id' : card_data.id,
		});

		var data_filter = [card_data.name, board_data.name];

		var card_menu = $('<div>', {'class': 'card-menu'}).html(
			'<span><i class="fa fa-chevron-down"></i></span>'
		);
		card.append(card_menu);

		var card_labels = $('<div>', {'class':'card-labels'});
		$.each(card_data.labels, function(index, label) {
			var item = $('<span>', {'class': 'label ' + label.color});
			card_labels.append(item);
		});

		var card_name = $('<div>', {'class':'card-name'}).text(card_data.name);

		var card_info = '';
		if(card_data.due)
		{
			var due = new Date(card_data.due);
			var dueformat = due.getDate() + ' ' + months[due.getMonth()];
			card_info = $('<div>', {'class':'card-info'})
				.html('<span class="due '+ due_class(card_data.due) +'"><i class="fa fa-clock-o"></i> ' + dueformat + '</span>'+
					' <span class="due '+ due_class(card_data.due) +'">' + moment(due).fromNow() + '</span>');
		}

		var additional_list_info = (render_list_name) ? ' (' + list_data.name + ')' : '';

		var board_info = $('<div>', {'class':'board-info'})
			.html('in <span class="board-link" href="' + board_data.url + '" target="_blank">' + board_data.name + '</span>' + additional_list_info);

		card.append(card_labels).append(card_name).append(card_info).append(board_info);

		var members = $('<div>', {'class': 'members'});
		$.each(card_data.idMembers, function(index, id_member) {
			var member_data = window.engine_cache.member[id_member].data;
			var member = $('<div>', {'class': 'member'});

			member.text(member_data.initials).attr('title', member_data.fullName);
			if(member_data.avatarHash)
			{
				member.css('background-image', 'url("https://trello-avatars.s3.amazonaws.com/'+ member_data.avatarHash +'/50.png")');
			}
			else
			{
				member.addClass('no-avatar');
			}

			members.append(member);

			data_filter.push(member_data.fullName);
		});

		card.attr('data-filter', data_filter.join(' '));

		card.append(members);

		return card;
	}

	function generate_rule(raw) {
		var rules = {};
		$.each(raw, function(index, item) {
			rules[ item.name ] = {
				regex : new RegExp(item.regex, 'i'),
				items: [],
			};
		});

		rules.Other = {
			regex : new RegExp('.', 'i'),
			items: [],
		};

		return rules;
	}


	/* All DOM events (click, keypress, etc) */
	function dom_events()
	{
		/* List & card related */
		$(document).on('recount', '.list', function(event) {
			var list = $(this);
			list.find('.list-name .count').text( list.find('.card:visible').length );
		});
		$(document).on('click', '.list-footer', function(event) {
			event.preventDefault();
			$(this).parents('.list').find('.card:visible').each(function(index, val) {
				this.click();
			});
		});
		$(document).on('change', '.list select', function(event) {
			var el          = $(this);
			var list        = el.parents('.list');
			var list_scroll = list.find('.list-scroll');
			var list_name   = list.find('.list-name .name').text();

			var items = categories[list_name].items;

			switch(el.val())
			{
				case 'board' :
					items.sort(sort_by_board);
					break;
				case 'due'   :
					items.sort(sort_by_due);
					break;
				case 'name'  :
					items.sort(sort_by_name);
					break;
				case 'label'  :
					items.sort(sort_by_label);
					break;
			}

			list_scroll.html('');

			$.each(items, function(index, item) {
				list_scroll.append( render_card(item) );
			});
		});
		$(document).on('click', '.board-link', function(event) {
			event.preventDefault();
			$('<a>',{href: $(this).attr('href'), target: '_blank'})[0].click();
		});


		/* Sub header button related */
		$(document).on('click', '.help-btn', function(event) {
			event.preventDefault();
			$('.modal-help').addClass('show');
		});
		$(document).on('click', '.notif-btn', function(event) {
			event.preventDefault();
			$('.modal-notif').addClass('show');

			$('.modal-notif .notif-content').html('<div class="notif-loading">loading notifications..</div>');
			Trello.get('/members/me/notifications', {entities:true}, function(data){
				console.log(data);

				var render = function(entity) {
					var result      = '';
					var url         = '#';
					var trello_home = 'https:/trello.com';

					switch(entity.type)
					{
						case 'card':
							url    = trello_home + '/c/' + entity.shortLink;
							result = '<a href="'+url+'" target="_blank" class="card">'+entity.text+'</a>';
							break;
						case 'board':
							url    = trello_home + '/b/' + entity.shortLink;
							result = '<a href="'+url+'" target="_blank" class="board">'+entity.text+'</a>';
							break;
						case 'member':
							result = '<span class="member">'+entity.text+'</span>';
							break;
						case 'text':
							result = entity.text;
							break;
						case 'list':
							result = '<span class="list">'+entity.text+'</span>';
							break;
						case 'comment':
							var content = entity.text.replace(/\B(\@\w+)/g, '<strong>$&</strong>');
							result = '<br><div class="comment">'+content+'</div>';
							break;
						case 'relDate':
							result = entity.current;
							break;
					}

					return result;
				};

				$('.modal-notif .notif-content').html('');
				data.forEach(function(item, index){
					var renders = [];
					item.entities.forEach(function(entity, i){
						renders.push( render(entity) );
					});

					var date_human = moment.duration(new Date() - new Date(item.date)).humanize() + ' ago';
					renders.push('<div class="date">'+date_human+'</div>');

					// console.log(renders.join(' '));
					var unread = item.unread ? 'unread' : '';
					var icon_image = item.memberCreator && item.memberCreator.avatarHash ?
						'background-image: url(\'https://trello-avatars.s3.amazonaws.com/'+ item.memberCreator.avatarHash +'/50.png\')' :
						'';
					$('.modal-notif .notif-content').append(
						'<div class="notif-item '+ unread +'">'+
						'<div class="icon" style="'+ icon_image +'"></div>'+
						renders.join(' ') +
						'</div>'
					);
				});
			})
			.fail(function(data) {
				$('.modal-notif .notif-content').html('<div class="notif-loading">Sorry failed to load notifications.</div>');
			});
		});
		$(document).on('click', '.modal-notif .read-all', function(event) {
			Trello.post('/notifications/all/read', function(data) {
				$('.modal-notif .notif-content .unread').removeClass('unread');
			});
		});
		$(document).on('click', '.right-panel .setting', function(event) {
			event.preventDefault();
			modal_setting();
			$('.modal-setting').addClass('show');
		});
		$(document).on('click', '.right-panel .refresh', function(event) {
			event.preventDefault();
			window.MyTrelloCards.refresh();
		});
		$(document).on('keypress', function(event) {
			if(event.which == 63 && !$('.modal-setting.show').length)
			{
				$('.modal-help').addClass('show');
			}
		});


		$(document).on('click', '.member-btn', function(event) {
			var allowed = ['fuadyusuf_kh','ariefwidyananda_kh','arpa_kh','indraramdhani_kh','alialhadi_kh','dewi_kh','dhikamandala_kh','silvia_kh','dekka_kh','yustinaayu_kh','fidelisasterina_kh','dewimaharaniku_kh','ayboy_kh'];
			if(allowed.indexOf(engine_cache.me.username) > -1)
			{
				$('.modal-member').addClass('show');
				$('.modal-member .member-content').html('<div class="notif-loading">loading members..</div>');

				var render_member = function() {
					$('.modal-member .member-content').html('');
					var sorted_member = Object.values(engine_cache.member).sort(function(a, b) {
						return a.data.fullName.localeCompare(b.data.fullName);
					});
					$.each(sorted_member, function(index, item) {
						var member_data = item.data;

						var member = $('<div>', {'class': 'member'});
						member.text(member_data.initials).attr('title', member_data.fullName);
						if(member_data.avatarHash)
						{
							member.css('background-image', 'url("https://trello-avatars.s3.amazonaws.com/'+ member_data.avatarHash +'/50.png")');
						}
						else
						{
							member.addClass('no-avatar');
						}

						var html = '<a href="#member-'+ member_data.id +'" target="_blank" class="single-member">'+
								member[0].outerHTML+
								member_data.fullName+
						'</a>';
						$('.modal-member .member-content').append(html);
					});
				};

				// engine_cache.
				if(!engine_cache.vars.all_member)
				{
					Trello.get("/members/me/organizations", function(orgs) {
						var defer = new $.Deferred();
						orgs.forEach(function(org, index_org){
							// console.log(org);
							Trello.get("organizations/"+ org.id +"/members", function(members) {
								members.forEach(function(member, i){
									// console.log(member.fullName);
									if(!engine_cache.member[member.id]) engine_cache.member[member.id] = {
										data      : false,
										isDone    : false,
										isSuccess : false,
									};
								});
								if(index_org+1 == orgs.length)
								{
									defer.resolve();
								}
							});
						});

						var prom = defer.promise();
						prom.done(function(data) {
							setTimeout(function() {
								my_trello_batch('member')
								.progress(function(p){
									console.log( p, 'Fetching All Members...' );
								})
								.then(function() {
									console.log( 'Fetching All Members Done' );

									engine_cache.vars.all_member = true;
									render_member();
								});
							}, 500);
						});
					});
				}
				else
				{
					render_member();
				}
			}
		});

		/* Modal related */
		$(document).on('click', '.modal .modal-backdrop', function(event) {
			event.preventDefault();
			$(this).parents('.modal').removeClass('show');
		});
		$(document).on('click', '.modal-setting .save', function(event) {
			event.preventDefault();

			var data = $('#form-setting').serializeJSON();

			if(data['custom-list'])
			{
				data['custom-list'] = data['custom-list'].filter(function(item) {
					return (!!item.name);
				});
			}

			data['hidden-cards-groups'] = {};
			$('.modal-setting .hidden-card').each(function(index, el) {
				var item     = $(this);
				var id_board = item.parent().data('id');

				if(!data['hidden-cards-groups'][id_board])
				{
					data['hidden-cards-groups'][id_board] = {};
				}

				data['hidden-cards-groups'][id_board][item.data('id')] = item.text();
			});

			localStorage.setItem('mytrellocards-setting', JSON.stringify(data));

			/* Apply settings */
			apply_settings();

			$('.modal-setting').removeClass('show');

			window.MyTrelloCards.refresh();
		});
		$(document).on('click', '.modal-setting .close', function(event) {
			event.preventDefault();
			$('.modal-setting').removeClass('show');
		});
		$(document).on('click', '.modal-setting .hidden-card .fa', function(event) {
			var item = $(this).parent();

			item.fadeOut(300, function() {
				item.remove();
			});
		});
		$(document).on('click', '.modal-setting .add-custom-list-btn', function(event) {
			event.preventDefault();
			var template     = $.trim( $('#custom-list-template').html() );
			var custom_lists = $('.modal-setting .custom-lists');
			custom_lists.append(template);
		});
		$(document).on('click', '.modal-setting .custom-list .btn-remove', function(event) {
			event.preventDefault();
			var custom_list = $(this).parents('.custom-list');
			custom_list.remove();
		});
		$(document).on('click', '.modal-setting .reset-custom-list-btn', function(event) {
			event.preventDefault();
			var template     = $.trim( $('#custom-list-template').html() );
			var custom_lists = $('.modal-setting .custom-lists');

			custom_lists.html('');
			$.each(default_list, function(index, item) {
				var custom_list = $(template);
				custom_list.find('.name').val(item.name);
				custom_list.find('.regex').val(item.regex);
				if(item.default)
				{
					custom_list.addClass('default-list');
					custom_list.find('.name').prop('readonly', 'readonly');
					custom_list.find('.default').val(1);
				}
				custom_lists.append(custom_list);
			});
		});
		$(document).on('click', '.modal-setting .modal-option-btn', function(event) {
			event.preventDefault();
			event.stopPropagation();
			var menu_list = $(this).siblings('.modal-menu-list');
			menu_list.toggleClass('open');
		});
		$(document).on('click', '.modal-setting .modal-menu-list .backup-settings', function(event) {
			event.preventDefault();
			MyTrelloCards.backup_settings();
		});
		$(document).on('change', '.modal-setting .modal-menu-list .restore-settings input', function(event) {
			var input = this;
			if(input.files.length)
			{
				var file   = input.files[0];
				var blob   = file.slice(0, file.size);
				var reader = new FileReader();

				reader.onloadend = function(evt) {
					if (evt.target.readyState == FileReader.DONE) {
						try {
							var json = JSON.parse(evt.target.result);

							localStorage.setItem('mytrellocards-setting', JSON.stringify(json[0]));
							localStorage.setItem('mytrellocards-hide-card-expires', JSON.stringify(json[1]));

							apply_settings();
							$('.modal-setting').removeClass('show');
							window.MyTrelloCards.refresh();
						}
						catch(e)
						{
							alert('Invalid My Trello Cards setting file.');
						}
					}
				};

				reader.readAsBinaryString(blob);
			}
		});


		/* Card menu related */
		var current_card_action = false;
		$(document).on('click', '.card-menu', function(event) {
			event.preventDefault();
			event.stopPropagation();
		});
		$(document).on('click', '.card-menu span', function(event) {
			var button       = $(this);
			var offset       = button.offset();
			var menu         = $('.card-menu-list');
			var card         = button.parents('.card');
			var card_id      = card.data('id');
			var scroll       = $('.content .scroll');
			var scroll_width = scroll.outerWidth();
			var menu_left    = offset.left - scroll.offset().left - menu.width() + 14;
			var list_width   = $('.scroll .list').eq(0).width();

			if(current_card_action != card_id)
			{
				current_card_action = card_id;
				menu.removeClass('open show-custom-hide');
				menu.css({
					top: offset.top + 18,
					left: menu_left
				});

				menu.removeClass('date-picker-on-left');
				if(scroll_width - (list_width * 2) < menu_left)
				{
					menu.addClass('date-picker-on-left');
				}

				menu.toggleClass('open');
			}
			else
			{
				menu.toggleClass('open');
			}
		});
		$(document).on('click', '.card-menu-list .hide-card', function(event) {
			$('.card-menu-list').removeClass('open show-custom-hide');
		});
		$(document).on('click', '.card-menu-list .hide-card', function(event) {
			var button     = $(this);
			var card       = $('.card-' + current_card_action);
			var card_id    = current_card_action;
			var card_name  = card.find('.card-name').text();

			var duration   = button.data('duration');
			var expire     = duration ? new Date( (new Date()).getTime() + duration ).toString() : false;

			hide_card(card_id, card_name, expire);
			apply_settings();
		});
		$(document).on('click', '.card-menu-list .hide-card-until', function(event) {
			event.preventDefault();
			event.stopPropagation();
			var menu = $(this).parents('.card-menu-list');
			menu.toggleClass('show-custom-hide');
		});
		$(document).on('click', '.card-menu-list .hide-date-picker', function(event) {
			event.preventDefault();
			event.stopPropagation();
		});
		$(document).on('click', '.card-menu-list .hide-custom-btn', function(event) {
			var card      = $('.card-' + current_card_action);
			var card_id   = current_card_action;
			var card_name = card.find('.card-name').text();
			// var date      = $('.hide-date-picker .date-picker').datetimepicker('getValue');
			var date      = new Date($('.date-picker').val());

			hide_card(card_id, card_name, date.toString());
			$('.card-menu-list').removeClass('open show-custom-hide');
			apply_settings();
		});
		$(document).on('click', 'body', function(event) {
			$('.card-menu-list.open, .modal-menu-list.open').removeClass('open show-custom-hide');
		});

		/* Drag scroll content */
		$('.content').dragscrollable({
			except: '.list-header, .list-scroll, .list-footer'
		});

		/* Modal setting sortable custom lists */
		Sortable.create($('.modal-setting .custom-lists')[0], {
			draggable : '.custom-list',
			handle    : '.sort-handle',
			animation : 150
		});

		Sortable.create($('.modal-setting .label-priority')[0], {
			draggable : '.label-item',
			animation : 150
		});

		/* date time picker */
		// $('.hide-date-picker .date-picker').datetimepicker({
		// 	inline: true,
		// });
		flatpickr('.hide-date-picker .date-picker', {
			inline: true,
			enableTime: true,
		});

		/* Auto refresh after a certain time tab not focussed */
		var refresh_timeout = false;
		window.MyTrelloCards.need_refresh = false;
		document.addEventListener('visibilitychange', function(event){
			clearTimeout(refresh_timeout);

			if(document.hidden)
			{
				refresh_timeout = setTimeout(function() {
					window.MyTrelloCards.need_refresh = true;
				}, 1000 * 60 * 5);
			}
			else
			{
				if(window.MyTrelloCards.need_refresh)
				{
					window.MyTrelloCards.need_refresh = false;
					window.MyTrelloCards.refresh();
				}
			}
		});

		/* Filter cards*/
		$(document).on('change', '.input-filter', function(event) {
			var filter = this.value;
			$('.card').addClass('filtered').each(function(index, el) {
				var card = $(el);
				if( (new RegExp(filter, 'i')).test(card.data('filter')) )
				{
					card.removeClass('filtered');
				}
			});
		});
		$(document).on('click', '.filter-box .fa-remove', function(event) {
			$('.input-filter').val('');
			$('.card').removeClass('filtered');
		});
	}



	/* Sort functions */
	function sort_by_board(a, b)
	{
		var a_board   = window.engine_cache.board[a.idBoard].data;
		var b_board   = window.engine_cache.board[b.idBoard].data;

		if(!!a_board && !!b_board)
		{
			var result = a_board.name.localeCompare(b_board.name);
			// if(result === 0)
			// {
			// 	result = a.name.localeCompare(b.name);
			// }

			return result;
		}
		else
		{
			return true;
		}
	}

	function sort_by_due(a, b)
	{
		var result = false;
		var a_date = (new Date(a.due));
		var b_date = (new Date(b.due));

		result = b_date - a_date;

		if(result === 0)
		{
			result = (new Date(b.dateLastActivity)) - (new Date(a.dateLastActivity));
		}

		return result;
	}

	function sort_by_name(a, b)
	{
		var result = a.name.localeCompare(b.name);
		return result;
	}

	function sort_by_label(a, b) {
		var values = (function(items) {
			$.each(items, function(i, v) {
				var prio = 100;
				$.each(v.labels, function(index, item) {
					var number = label_prio.indexOf(item.color);
					prio       = number < prio ? number : prio;
				});
				items[i] = prio;
			});

			return items;
		})([a,b]);

		return values[0] - values[1];
	}


	/* CSS related functions */
	function addCSSRule(sheet, selector, rules, index)
	{
		if("insertRule" in sheet) {
			sheet.insertRule(selector + "{" + rules + "}", index);
		}
		else if("addRule" in sheet) {
			sheet.addRule(selector, rules, index);
		}
	}

	function clearCSSRules(sheet)
	{
		var i = sheet.cssRules.length - 1 ;

		// Remove all the rules from the end inwards.
		while(i >= 0){
			if("deleteRule" in sheet)
			{
				sheet.deleteRule(i);
			}
			else if("removeRule" in sheet)
			{
				sheet.removeRule(i);
			}

			i--;
		}
	}



	/* Settings related functions */
	function modal_setting() {
		var settings = JSON.parse(localStorage.getItem('mytrellocards-setting'));
		var cache    = JSON.parse(localStorage.getItem('mytrellocards-cache'));
		var expires  = JSON.parse( localStorage.getItem('mytrellocards-hide-card-expires') );

		var boards   = (function() {
			var boards = [];
			$.each(cache.board, function(index, name) {
				boards.push({id: index, name: name});
			});
			boards.sort(function(a,b) {
				return a.name.localeCompare(b.name);
			});
			return boards;
		}());

		var select_boards = $('.modal-setting .select-boards');
		select_boards.html('');
		$.each(boards, function(index, val) {
			var label  = $('<label>');
			var select = $('<input>', {type: 'checkbox', name: 'hidden-boards[]', value: val.id});

			if(settings['hidden-boards'] && settings['hidden-boards'].indexOf(val.id) > -1)
			{
				select.attr('checked', 1);
			}

			label.append(select).append(val.name);
			select_boards.append(label);
		});

		if(settings['bg-color'])
		{
			$('.modal-setting [name="bg-color"]').val(settings['bg-color']);
		}

		if(settings['bg-image'])
		{
			$('.modal-setting [name="bg-image"]').val(settings['bg-image']);
		}

		$('.modal-setting .hidden-cards-groups').html('');
		if(settings['hidden-cards-groups'])
		{
			var hidden_cards_group = $('.modal-setting .hidden-cards-groups');
			$.each(settings['hidden-cards-groups'], function(id_board, cards) {
				var card_group = $('<div>',{'class':'card-group', 'data-id': id_board});
				card_group.append('<span class="group-name">'+ cache.board[id_board] +'</span>');

				if(Object.keys(cards).length)
				{
					$.each(cards, function(index, val) {
						var title = '';
						if(expires[index])
						{
							var expiry = new Date(expires[index]);
							title = 'Hidden until ' +
								[expiry.getDate(), months[expiry.getMonth()], expiry.getFullYear(), ''].join(' ') +
								[("00" + expiry.getHours()).slice(-2), ("00" + expiry.getMinutes()).slice(-2)].join(':');
						}
						var item = '<span class="hidden-card" data-id="'+ index +'" title="'+ title +'">'+ val +' <i class="fa fa-remove" title="cancel hide"></i></span>';
						card_group.append(item);
					});
					hidden_cards_group.append(card_group);
				}
			});
		}

		var custom_lists = $('.modal-setting .custom-lists');
		custom_lists.html('');
		if(settings['custom-list'])
		{
			var template = $.trim( $('#custom-list-template').html() );
			$.each(settings['custom-list'], function(index, item) {
				var custom_list = $(template);
				custom_list.find('.name').val(item.name);
				custom_list.find('.regex').val(item.regex);
				if(item.default)
				{
					custom_list.addClass('default-list');
					custom_list.find('.name').prop('readonly', 'readonly');
					custom_list.find('.default').val(1);
				}
				custom_lists.append(custom_list);
			});
		}

		if(settings['label-priority'])
		{
			var items = $('.modal-setting .label-priority .label-item').detach();
			items.sort(function (a, b){
				var a_prio = settings['label-priority'].indexOf(a.dataset.color);
				var b_prio = settings['label-priority'].indexOf(b.dataset.color);
				return a_prio - b_prio;
			});
			$('.modal-setting .label-priority').append(items);
		}
	}

	function apply_settings() {
		var settings           = JSON.parse(localStorage.getItem('mytrellocards-setting'));
		var css                = document.styleSheets[document.styleSheets.length - 1];
		var hidden_board_count = 0;
		var hidden_card_count  = 0;

		if(!settings)
		{
			settings = {
				'bg-color'            : '#2b6c91',
				'bg-image'            : '',
				'hidden-boards'       : [],
				'hidden-cards-groups' : {},
				'custom-list'         : default_list,
				'label-priority'      : label_prio,
			};

			localStorage.setItem('mytrellocards-setting', JSON.stringify(settings));
		}

		clearCSSRules(css);

		if(!!settings['hidden-boards'])
		{
			var hide_board_sel = '.board-' + settings['hidden-boards'].join(', .board-');
			addCSSRule(css, hide_board_sel, 'display: none!important;', 0);

			hidden_board_count = settings['hidden-boards'].length;
		}

		if(!!settings['hidden-cards-groups'])
		{
			var expires = JSON.parse( localStorage.getItem('mytrellocards-hide-card-expires') );
			var now = new Date();

			$.each(settings['hidden-cards-groups'], function(group, items) {
				$.each(items, function(index, val) {
					if(expires && expires[index])
					{
						var expiry = new Date(expires[index]);
						if(now >= expiry)
						{
							delete settings['hidden-cards-groups'][group][index];
							hide_card_expiry(index);
							return true;
						}
					}
					var hide_card_sel = '.card-' + index;
					addCSSRule(css, hide_card_sel, 'display: none!important;', 0);
					hidden_card_count++;
				});
			});

			localStorage.setItem('mytrellocards-setting', JSON.stringify(settings));
		}

		var hidden_item_msg = function(board, card) {
			var msg = [];

			if(board)
			{
				msg.push(board + ' board' + (board > 1 ? 's' : ''));
			}

			if(card)
			{
				msg.push(card + ' card' + (card > 1 ? 's' : ''));
			}

			if(msg.length)
			{
				return 'You hide ' + msg.join(' and ');
			}
			else
			{
				return false;
			}
		};

		var hidden_items = $('.hidden-items');
		var msg = hidden_item_msg(hidden_board_count, hidden_card_count);
		if(msg)
		{
			hidden_items.find('span').text(msg);
			hidden_items.css('display', 'inline-block');
		}
		else
		{
			hidden_items.css('display', 'none');
		}

		if(settings['bg-color'])
		{
			$('body').css('background-color', settings['bg-color']);
		}

		if(settings['bg-image'])
		{
			$('body').css('background-image', 'url('+ settings['bg-image'] +')');
		}
		else
		{
			$('body').css('background-image', '');
		}

		if(settings['custom-list'])
		{
			categories = generate_rule(settings['custom-list']);
		}

		if(settings['label-priority'])
		{
			label_prio = settings['label-priority'];
		}

		$('.list').trigger('recount');
	}

	function download_json(data, filename) {
		var a      = document.createElement("a"),
		    json   = JSON.stringify(data, null, "\t"),
			blob   = new Blob([json], {type: "octet/stream"}),
			url    = window.URL.createObjectURL(blob);
		a.href     = url;
		a.download = filename;
		a.click();
	}


	function save_cache(cache, cards) {
		var saved_cache = JSON.parse( localStorage.getItem('mytrellocards-cache') );

		if(!saved_cache)
		{
			saved_cache = {
				organization : {},
				board        : {},
				list         : {},
				member       : {},
			};
		}

		$.each(cache, function(index_cache, cache_items) {
			$.each(cache_items, function(index, data) {
				if(data && data.data)
				{
					saved_cache[index_cache][index] = data.data.name;
				}
			});
		});

		localStorage.setItem('mytrellocards-cache', JSON.stringify(saved_cache));

		$.each(cards, function(index, card) {
			card_cache[card.id] = card;
		});
	}

	function hide_card(card_id, card_name, expire) {
		var settings = JSON.parse(localStorage.getItem('mytrellocards-setting'));
		var list_data  = window.engine_cache.list[ card_cache[card_id].idList ].data;
		var board_data = window.engine_cache.board[ card_cache[card_id].idBoard ].data;

		hide_card_expiry(card_id, expire);
		if(settings)
		{
			if(!settings['hidden-cards-groups'])
			{
				settings['hidden-cards-groups'] = {};
			}
			if(!settings['hidden-cards-groups'][board_data.id])
			{
				settings['hidden-cards-groups'][board_data.id] = {};
			}
			settings['hidden-cards-groups'][board_data.id][card_id] = card_name;
		}

		localStorage.setItem( 'mytrellocards-setting', JSON.stringify(settings) );
	}

	function hide_card_expiry(id_card, time) {
		var expires = JSON.parse( localStorage.getItem('mytrellocards-hide-card-expires') );

		if(!expires)
		{
			expires = {};
		}

		if(time)
		{
			expires[id_card] = time;
		}
		else
		{
			if(expires[id_card]) delete expires[id_card];
		}

		localStorage.setItem('mytrellocards-hide-card-expires', JSON.stringify(expires));
	}


	var MyTrelloCards = {
		init: function() {
			var self = this;

			apply_settings();

			// window.dev_mode = true;
			if(window.dev_mode)
			{
				$('.content .loading .bar').css('width', '100%');
				$('.content .loading .message').text('Entering Dev Mode..');

				window.engine_cache = {"organization":{"515b987e9b185b301000132f":{"data":{"id":"515b987e9b185b301000132f","name":"krafthausindonesia","displayName":"Krafthaus Indonesia","desc":"All about krafthaus Indonesia","descData":null,"url":"https://trello.com/krafthausindonesia","website":null,"logoHash":"508d5248cdd580d8f84a68047cf190bc","products":[],"powerUps":[]},"isDone":true,"isSuccess":true},"4ffc281a5c2dbbd569105480":{"data":{"id":"4ffc281a5c2dbbd569105480","name":"krafthaus","displayName":"Krafthaus - WIP","desc":"","descData":null,"url":"https://trello.com/krafthaus","website":"http://www.krafthaus.com.au","logoHash":"854721e0073b5de92b165b1874f23679","products":[],"powerUps":[]},"isDone":true,"isSuccess":true}},"board":{"52dcc54f5585ca617a7b377f":{"data":{"id":"52dcc54f5585ca617a7b377f","name":"Plugins and Tools","desc":"","descData":null,"closed":false,"idOrganization":"515b987e9b185b301000132f","pinned":false,"url":"https://trello.com/b/VJv1y2Zd/plugins-and-tools","shortUrl":"https://trello.com/b/VJv1y2Zd","prefs":{"permissionLevel":"org","voting":"disabled","comments":"members","invitations":"members","selfJoin":true,"cardCovers":false,"cardAging":"regular","calendarFeedEnabled":false,"background":"bricks","backgroundImage":"https://d2k1ftgv7pobq7.cloudfront.net/images/backgrounds/bricks.png","backgroundImageScaled":null,"backgroundTile":true,"backgroundBrightness":"dark","backgroundColor":null,"canBePublic":true,"canBeOrg":true,"canBePrivate":true,"canInvite":true},"labelNames":{"green":"","yellow":"","orange":"","red":"","purple":"","blue":"","sky":"","lime":"","pink":"","black":""}},"isDone":true,"isSuccess":true},"538e9474e9270cb143b1ab9e":{"data":{"id":"538e9474e9270cb143b1ab9e","name":"RMIT Alumni E-mag 4 (Mid-October)","desc":"","descData":null,"closed":false,"idOrganization":"4ffc281a5c2dbbd569105480","pinned":false,"url":"https://trello.com/b/INakyhif/rmit-alumni-e-mag-4-mid-october","shortUrl":"https://trello.com/b/INakyhif","prefs":{"permissionLevel":"private","voting":"disabled","comments":"members","invitations":"members","selfJoin":false,"cardCovers":false,"cardAging":"regular","calendarFeedEnabled":false,"background":"green","backgroundImage":null,"backgroundImageScaled":null,"backgroundTile":false,"backgroundBrightness":"dark","backgroundColor":"#519839","canBePublic":true,"canBeOrg":true,"canBePrivate":true,"canInvite":true},"labelNames":{"green":"","yellow":"","orange":"","red":"","purple":"","blue":"","sky":"","lime":"","pink":"","black":""}},"isDone":true,"isSuccess":true},"53cc963372426d78be85bff0":{"data":{"id":"53cc963372426d78be85bff0","name":"Catatan Awan","desc":"","descData":null,"closed":false,"idOrganization":null,"pinned":false,"url":"https://trello.com/b/c3F4Xvir/catatan-awan","shortUrl":"https://trello.com/b/c3F4Xvir","prefs":{"permissionLevel":"private","voting":"disabled","comments":"members","invitations":"members","selfJoin":false,"cardCovers":true,"cardAging":"regular","calendarFeedEnabled":false,"background":"subtle-irongrip","backgroundImage":"https://d2k1ftgv7pobq7.cloudfront.net/images/backgrounds/subtle-irongrip.png","backgroundImageScaled":null,"backgroundTile":true,"backgroundBrightness":"dark","backgroundColor":null,"canBePublic":true,"canBeOrg":true,"canBePrivate":true,"canInvite":true},"labelNames":{"green":"","yellow":"","orange":"","red":"","purple":"","blue":"","sky":"","lime":"","pink":"","black":""}},"isDone":true,"isSuccess":true},"569c3ca9ed7fefb5c6b1b549":{"data":{"id":"569c3ca9ed7fefb5c6b1b549","name":"New Internship Training","desc":"","descData":null,"closed":false,"idOrganization":"515b987e9b185b301000132f","pinned":false,"url":"https://trello.com/b/Jeq7yqpt/new-internship-training","shortUrl":"https://trello.com/b/Jeq7yqpt","prefs":{"permissionLevel":"private","voting":"disabled","comments":"members","invitations":"members","selfJoin":false,"cardCovers":true,"cardAging":"regular","calendarFeedEnabled":false,"background":"blue","backgroundImage":null,"backgroundImageScaled":null,"backgroundTile":false,"backgroundBrightness":"dark","backgroundColor":"#0079BF","canBePublic":true,"canBeOrg":true,"canBePrivate":true,"canInvite":true},"labelNames":{"green":"","yellow":"","orange":"","red":"","purple":"","blue":"","sky":"","lime":"","pink":"","black":""}},"isDone":true,"isSuccess":true},"569d8f99ca6065157000a2bc":{"data":{"id":"569d8f99ca6065157000a2bc","name":"New Internship Training - Playground","desc":"","descData":null,"closed":false,"idOrganization":"515b987e9b185b301000132f","pinned":false,"url":"https://trello.com/b/UBvNwGGs/new-internship-training-playground","shortUrl":"https://trello.com/b/UBvNwGGs","prefs":{"permissionLevel":"private","voting":"disabled","comments":"members","invitations":"members","selfJoin":false,"cardCovers":true,"cardAging":"regular","calendarFeedEnabled":false,"background":"blue","backgroundImage":null,"backgroundImageScaled":null,"backgroundTile":false,"backgroundBrightness":"dark","backgroundColor":"#0079BF","canBePublic":true,"canBeOrg":true,"canBePrivate":true,"canInvite":true},"labelNames":{"green":"","yellow":"","orange":"","red":"","purple":"","blue":"","sky":"","lime":"","pink":"","black":""}},"isDone":true,"isSuccess":true},"5608c446b1df9c1e98e3d1df":{"data":{"id":"5608c446b1df9c1e98e3d1df","name":"Video Content Development Board","desc":"","descData":null,"closed":false,"idOrganization":null,"pinned":false,"url":"https://trello.com/b/o9OCDUbi/video-content-development-board","shortUrl":"https://trello.com/b/o9OCDUbi","prefs":{"permissionLevel":"private","voting":"disabled","comments":"members","invitations":"members","selfJoin":false,"cardCovers":true,"cardAging":"regular","calendarFeedEnabled":false,"background":"red","backgroundImage":null,"backgroundImageScaled":null,"backgroundTile":false,"backgroundBrightness":"dark","backgroundColor":"#B04632","canBePublic":true,"canBeOrg":true,"canBePrivate":true,"canInvite":true},"labelNames":{"green":"","yellow":"","orange":"","red":"","purple":"","blue":"","sky":"","lime":"","pink":"","black":""}},"isDone":true,"isSuccess":true}},"list":{"5327ca291ae0c5090f687a0a":{"data":{"id":"5327ca291ae0c5090f687a0a","name":"On Hold","closed":false,"idBoard":"52dcc54f5585ca617a7b377f","pos":4096},"isDone":true,"isSuccess":true},"54dae179b313667abade6649":{"data":{"id":"54dae179b313667abade6649","name":"General Info","closed":false,"idBoard":"538e9474e9270cb143b1ab9e","pos":14336},"isDone":true,"isSuccess":true},"53cc963372426d78be85bff1":{"data":{"id":"53cc963372426d78be85bff1","name":"To Do","closed":false,"idBoard":"53cc963372426d78be85bff0","pos":16384},"isDone":true,"isSuccess":true},"5629e345d048d01120a4f19c":{"data":{"id":"5629e345d048d01120a4f19c","name":"On Development","closed":false,"idBoard":"52dcc54f5585ca617a7b377f","pos":26624},"isDone":true,"isSuccess":true},"53cc963372426d78be85bff2":{"data":{"id":"53cc963372426d78be85bff2","name":"Doing","closed":false,"idBoard":"53cc963372426d78be85bff0","pos":32768},"isDone":true,"isSuccess":true},"569c3cc99a96ffb8eff0ebbd":{"data":{"id":"569c3cc99a96ffb8eff0ebbd","name":"Doing","closed":false,"idBoard":"569c3ca9ed7fefb5c6b1b549","pos":74240},"isDone":true,"isSuccess":true},"569d8fa09e037a23c665b517":{"data":{"id":"569d8fa09e037a23c665b517","name":"To Do","closed":false,"idBoard":"569d8f99ca6065157000a2bc","pos":131071},"isDone":true,"isSuccess":true},"55481eadc2db88724d7234f6":{"data":{"id":"55481eadc2db88724d7234f6","name":"To Confirm","closed":false,"idBoard":"53cc963372426d78be85bff0","pos":180224},"isDone":true,"isSuccess":true},"560b186e1c70ba50198f2ab4":{"data":{"id":"560b186e1c70ba50198f2ab4","name":"Publishing","closed":false,"idBoard":"5608c446b1df9c1e98e3d1df","pos":229375.5},"isDone":true,"isSuccess":true},"554821b6bc39f82fee42153b":{"data":{"id":"554821b6bc39f82fee42153b","name":"live check","closed":false,"idBoard":"53cc963372426d78be85bff0","pos":245760},"isDone":true,"isSuccess":true},"560b187d88d7cd281998bae4":{"data":{"id":"560b187d88d7cd281998bae4","name":"Done","closed":false,"idBoard":"5608c446b1df9c1e98e3d1df","pos":360447.5},"isDone":true,"isSuccess":true}},"member":{"52521456b9e7e63447002893":{"data":{"id":"52521456b9e7e63447002893","avatarHash":"4cdabc3fff85f0b7e8bad04e639198da","bio":"","bioData":{"emoji":{}},"confirmed":true,"fullName":"Fuad Yusuf","idPremOrgsAdmin":[],"initials":"FY","memberType":"normal","products":[],"status":"disconnected","url":"https://trello.com/fuadyusuf_kh","username":"fuadyusuf_kh","avatarSource":"upload","email":null,"gravatarHash":"dc10704a6b9bbcdc8a44c3fb292061c3","idBoards":["52521456b9e7e63447002895","511afc326c105ff352001314","5090a5d7303366de64000bce","52195bc04a4d05326b0028cd","51d50ccef67980d50c00141b","51270879e1b51005440026ae","523a833b6d4d0c433a002593","5181ecc43256b3da2b006bce","523b928229feed5301000f93","52491cbcafaf1eb97a00537d","5326c5bb2419d5f8368dd282","52dcc54f5585ca617a7b377f","53007555e27e3841469d5361","52240c7d6dc1b466050044a5","510229d178ced3f909003605","504a8b337e0147bb5230690b","51da0356db621df6320044c9","53685ee9d49052437a9affca","52f2e3f9b6fe72b009781339","537d59d5d5b54506fdad967d","531e797cb8be5c6666673acf","524123f0b6fc270b020008d1","5369b1fa630378673b7eb89f","53cc963372426d78be85bff0","538e9474e9270cb143b1ab9e","542cbaf1d29d44a749e7862a","5487e2d020360fa761495d39","54c029a1a11c05439677b017","54cec5a673426592e04ff0ea","55137660b2918f226ba6c700","5541c67b1a1724cb1f35261e","5451bced4ac97f441032a73e","5587bcf1274fe31738d22469","559488ef678bc3b19ea8277c","5577a95c8e6173ff4e6cfbaa","55c3226675005e472c8f28a1","55cbd0ba1dfcb40474e5a001","5608c446b1df9c1e98e3d1df","54f7da7decb211c2b2599613","558241f9af1fd608e2b9b437","561f441cf2e433c336d81a25","56274b9390dd973513881a34","562f323811d55f2c5f6763b7","5546ea811378bf5dd657161e","533371cb4fb9b2b152631a89","546d6650a9d7f2df3bb008c3","5678b0b703bf25219f87b156","56722c20fda38ad1ff5dfe2d","569c3ca9ed7fefb5c6b1b549","569d8f99ca6065157000a2bc"],"idOrganizations":["515b987e9b185b301000132f","4ffc281a5c2dbbd569105480","561f331502d08eeb42cda8c0"],"loginTypes":null,"oneTimeMessagesDismissed":["newtrelloIntro","GoldIntro"],"prefs":{"sendSummaries":true,"minutesBetweenSummaries":60,"minutesBeforeDeadlineToNotify":1440,"colorBlind":false,"locale":""},"trophies":[],"uploadedAvatarHash":"4cdabc3fff85f0b7e8bad04e639198da","premiumFeatures":[],"idBoardsPinned":null},"isDone":true,"isSuccess":true},"50272dc23c55422a1423c55a":{"data":{"id":"50272dc23c55422a1423c55a","avatarHash":"c5bd08f52f154ac56c7af443585c2433","bio":"Indonesian, Javanese.","bioData":{"emoji":{}},"confirmed":true,"fullName":"Arpa Adi Tyawan","idPremOrgsAdmin":[],"initials":"AT","memberType":"normal","products":[],"status":"disconnected","url":"https://trello.com/dainwatya_kh","username":"dainwatya_kh","avatarSource":null,"email":null,"gravatarHash":null,"idBoards":["5451bced4ac97f441032a73e","52a0015bf59644951e002c82","510229d178ced3f909003605","5577a95c8e6173ff4e6cfbaa","52491cbcafaf1eb97a00537d","53685ee9d49052437a9affca","55cbd0ba1dfcb40474e5a001","542cbaf1d29d44a749e7862a","54c029a1a11c05439677b017","56722c20fda38ad1ff5dfe2d","55137660b2918f226ba6c700","53007555e27e3841469d5361","558241f9af1fd608e2b9b437","52195bc04a4d05326b0028cd","51da0356db621df6320044c9","5369b1fa630378673b7eb89f","51d50ccef67980d50c00141b","51270879e1b51005440026ae","52ef27cab1a630bd4a23a7f1","559488ef678bc3b19ea8277c","5326c5bb2419d5f8368dd282","52f2e3f9b6fe72b009781339","5546ea811378bf5dd657161e","511afc326c105ff352001314","524123f0b6fc270b020008d1","559931a82bed49080d818f91","569c3ca9ed7fefb5c6b1b549","569d8f99ca6065157000a2bc","5487e2d020360fa761495d39","533371cb4fb9b2b152631a89","52dcc54f5585ca617a7b377f","523b928229feed5301000f93","538e9474e9270cb143b1ab9e","504a8b337e0147bb5230690b","54cec5a673426592e04ff0ea","515b98ef17ef341c6a003795","546d6650a9d7f2df3bb008c3","523a833b6d4d0c433a002593","5587bcf1274fe31738d22469","5090a5d7303366de64000bce","52240c7d6dc1b466050044a5","5541c67b1a1724cb1f35261e","531e797cb8be5c6666673acf","5678b0b703bf25219f87b156","5181ecc43256b3da2b006bce","5608c446b1df9c1e98e3d1df","508627d8ba4cabec3f002f63","537d59d5d5b54506fdad967d","55c3226675005e472c8f28a1"],"idOrganizations":["4ffc281a5c2dbbd569105480","515b987e9b185b301000132f"],"loginTypes":null,"oneTimeMessagesDismissed":null,"prefs":null,"trophies":[],"uploadedAvatarHash":null,"premiumFeatures":[],"idBoardsPinned":null},"isDone":true,"isSuccess":true},"51abed2947b1665137002d92":{"data":{"id":"51abed2947b1665137002d92","avatarHash":"a8204e4729cf745a497d8326b694353b","bio":"","bioData":{"emoji":{}},"confirmed":true,"fullName":"dyah isnaeny hidayah","idPremOrgsAdmin":[],"initials":"DH","memberType":"normal","products":[],"status":"disconnected","url":"https://trello.com/dyahisnaenyhidayah_kh","username":"dyahisnaenyhidayah_kh","avatarSource":null,"email":null,"gravatarHash":null,"idBoards":["5451bced4ac97f441032a73e","510229d178ced3f909003605","52491cbcafaf1eb97a00537d","53685ee9d49052437a9affca","542cbaf1d29d44a749e7862a","55137660b2918f226ba6c700","51da0356db621df6320044c9","5369b1fa630378673b7eb89f","51d50ccef67980d50c00141b","51270879e1b51005440026ae","52ef27cab1a630bd4a23a7f1","5326c5bb2419d5f8368dd282","52f2e3f9b6fe72b009781339","511afc326c105ff352001314","5487e2d020360fa761495d39","52dcc54f5585ca617a7b377f","523b928229feed5301000f93","538e9474e9270cb143b1ab9e","504a8b337e0147bb5230690b","54cec5a673426592e04ff0ea","546d6650a9d7f2df3bb008c3","523a833b6d4d0c433a002593","5587bcf1274fe31738d22469","531e797cb8be5c6666673acf","5678b0b703bf25219f87b156"],"idOrganizations":["4ffc281a5c2dbbd569105480","515b987e9b185b301000132f"],"loginTypes":null,"oneTimeMessagesDismissed":null,"prefs":null,"trophies":[],"uploadedAvatarHash":null,"premiumFeatures":[],"idBoardsPinned":null},"isDone":true,"isSuccess":true},"55221bfb29847ce10cdd57b2":{"data":{"id":"55221bfb29847ce10cdd57b2","avatarHash":null,"bio":"","bioData":null,"confirmed":true,"fullName":"Fuad Yusuf","idPremOrgsAdmin":[],"initials":"FY","memberType":"normal","products":[],"status":"disconnected","url":"https://trello.com/fuadyusuf","username":"fuadyusuf","avatarSource":null,"email":null,"gravatarHash":null,"idBoards":["53cc963372426d78be85bff0"],"idOrganizations":[],"loginTypes":null,"oneTimeMessagesDismissed":null,"prefs":null,"trophies":[],"uploadedAvatarHash":null,"premiumFeatures":[],"idBoardsPinned":null},"isDone":true,"isSuccess":true},"55519f07213d066f64ac7638":{"data":{"id":"55519f07213d066f64ac7638","avatarHash":"f48e640a43aef4f4c8b2ca90309b0842","bio":"","bioData":null,"confirmed":true,"fullName":"James Cole","idPremOrgsAdmin":[],"initials":"JC","memberType":"normal","products":[],"status":"disconnected","url":"https://trello.com/jamescole15","username":"jamescole15","avatarSource":null,"email":null,"gravatarHash":null,"idBoards":["52f2e3f9b6fe72b009781339","5626e7f15a0d62bc9c3188b7","5608c446b1df9c1e98e3d1df"],"idOrganizations":[],"loginTypes":null,"oneTimeMessagesDismissed":null,"prefs":null,"trophies":[],"uploadedAvatarHash":null,"premiumFeatures":[],"idBoardsPinned":null},"isDone":true,"isSuccess":true},"4ea12c6a97185d4e160d87fe":{"data":{"id":"4ea12c6a97185d4e160d87fe","avatarHash":"8d0d723aabfd4385296f33fd0e3dc72c","bio":"Software Developer | Project Manager | Studied Master of Computer Science","bioData":{"emoji":{"gogogo":"https://trello-emoji.s3.amazonaws.com/4ea12c6a97185d4e160d87fe/77481fd845c395067ea6e8826d3f2e3e/semangat.gif"}},"confirmed":true,"fullName":"Arief Widyananda","idPremOrgsAdmin":[],"initials":"AW","memberType":"normal","products":[],"status":"disconnected","url":"https://trello.com/ariefwidyananda_kh","username":"ariefwidyananda_kh","avatarSource":null,"email":null,"gravatarHash":null,"idBoards":["5451bced4ac97f441032a73e","52a0015bf59644951e002c82","510229d178ced3f909003605","5577a95c8e6173ff4e6cfbaa","52491cbcafaf1eb97a00537d","53685ee9d49052437a9affca","55cbd0ba1dfcb40474e5a001","542cbaf1d29d44a749e7862a","54c029a1a11c05439677b017","56722c20fda38ad1ff5dfe2d","55137660b2918f226ba6c700","53007555e27e3841469d5361","558241f9af1fd608e2b9b437","52195bc04a4d05326b0028cd","51da0356db621df6320044c9","5369b1fa630378673b7eb89f","51d50ccef67980d50c00141b","51270879e1b51005440026ae","52ef27cab1a630bd4a23a7f1","559488ef678bc3b19ea8277c","5326c5bb2419d5f8368dd282","54f7da7decb211c2b2599613","52f2e3f9b6fe72b009781339","5546ea811378bf5dd657161e","511afc326c105ff352001314","524123f0b6fc270b020008d1","559931a82bed49080d818f91","569c3ca9ed7fefb5c6b1b549","569d8f99ca6065157000a2bc","5487e2d020360fa761495d39","533371cb4fb9b2b152631a89","52dcc54f5585ca617a7b377f","523b928229feed5301000f93","538e9474e9270cb143b1ab9e","504a8b337e0147bb5230690b","54cec5a673426592e04ff0ea","515b98ef17ef341c6a003795","546d6650a9d7f2df3bb008c3","523a833b6d4d0c433a002593","5587bcf1274fe31738d22469","5090a5d7303366de64000bce","52240c7d6dc1b466050044a5","5541c67b1a1724cb1f35261e","531e797cb8be5c6666673acf","5678b0b703bf25219f87b156","5181ecc43256b3da2b006bce","5608c446b1df9c1e98e3d1df","508627d8ba4cabec3f002f63","537d59d5d5b54506fdad967d","55c3226675005e472c8f28a1"],"idOrganizations":["561f331502d08eeb42cda8c0","4ffc281a5c2dbbd569105480","515b987e9b185b301000132f"],"loginTypes":null,"oneTimeMessagesDismissed":null,"prefs":null,"trophies":[],"uploadedAvatarHash":null,"premiumFeatures":[],"idBoardsPinned":null},"isDone":true,"isSuccess":true}}};
				window.categories = {"To Do":{"regex":{},"items":[{"id":"5546f725255a539cd65c6d4c","badges":{"votes":0,"viewingMemberVoted":false,"subscribed":true,"fogbugz":"","checkItems":0,"checkItemsChecked":0,"comments":0,"attachments":0,"description":false,"due":"2016-01-19T05:00:00.000Z"},"checkItemStates":[],"closed":false,"dateLastActivity":"2016-01-19T05:36:19.806Z","desc":"","descData":null,"due":"2016-01-19T05:00:00.000Z","email":"fuadyusuf_kh+52521456b9e7e63447002893+5546f725255a539cd65c6d4c+fb41abcfafb6d522aa65987f42fb2bbd805c719a@boards.trello.com","idBoard":"53cc963372426d78be85bff0","idChecklists":[],"idList":"53cc963372426d78be85bff1","idMembers":["52521456b9e7e63447002893","55221bfb29847ce10cdd57b2"],"idMembersVoted":[],"idShort":24,"idAttachmentCover":null,"manualCoverAttachment":false,"labels":[],"idLabels":[],"name":"aliqua fugiat veniam ","pos":65535,"shortLink":"kFuCmcms","shortUrl":"https://trello.com/c/kFuCmcms","subscribed":true,"url":"https://trello.com/c/kFuCmcms/24-aliqua-fugiat-veniam"},{"id":"569d99cdbfd2b04707a7a774","badges":{"votes":0,"viewingMemberVoted":false,"subscribed":true,"fogbugz":"","checkItems":0,"checkItemsChecked":0,"comments":0,"attachments":0,"description":false,"due":null},"checkItemStates":[],"closed":false,"dateLastActivity":"2016-01-19T02:17:55.959Z","desc":"","descData":null,"due":null,"email":"fuadyusuf_kh+52521456b9e7e63447002893+569d99cdbfd2b04707a7a774+d535cfa8d826f512b20b484e3197ff52686d0278@boards.trello.com","idBoard":"569d8f99ca6065157000a2bc","idChecklists":[],"idList":"569d8fa09e037a23c665b517","idMembers":["52521456b9e7e63447002893"],"idMembersVoted":[],"idShort":6,"idAttachmentCover":null,"manualCoverAttachment":false,"labels":[],"idLabels":[],"name":"Project scope and brief","pos":16383.75,"shortLink":"OAjs3gwh","shortUrl":"https://trello.com/c/OAjs3gwh","subscribed":true,"url":"https://trello.com/c/OAjs3gwh/6-project-scope-and-brief"}]},"Doing":{"regex":{},"items":[{"id":"56974101d833fa542dab36bd","badges":{"votes":0,"viewingMemberVoted":false,"subscribed":true,"fogbugz":"","checkItems":0,"checkItemsChecked":0,"comments":0,"attachments":0,"description":false,"due":"2016-02-04T05:00:00.000Z"},"checkItemStates":[],"closed":false,"dateLastActivity":"2016-01-19T09:58:21.422Z","desc":"","descData":null,"due":"2016-02-04T05:00:00.000Z","email":"fuadyusuf_kh+52521456b9e7e63447002893+56974101d833fa542dab36bd+a46a98be94626c9208028a8d88690deb194da7bb@boards.trello.com","idBoard":"53cc963372426d78be85bff0","idChecklists":[],"idList":"53cc963372426d78be85bff2","idMembers":["52521456b9e7e63447002893"],"idMembersVoted":[],"idShort":51,"idAttachmentCover":null,"manualCoverAttachment":false,"labels":[{"id":"54655c1674d650d567173928","idBoard":"53cc963372426d78be85bff0","name":"good","color":"green","uses":2}],"idLabels":["54655c1674d650d567173928"],"name":"Reprehenderit in voluptate ","pos":393215,"shortLink":"XjGcONAh","shortUrl":"https://trello.com/c/XjGcONAh","subscribed":true,"url":"https://trello.com/c/XjGcONAh/51-reprehenderit-in-voluptate"},{"id":"5546ec082574e4d5c369aa81","badges":{"votes":0,"viewingMemberVoted":false,"subscribed":true,"fogbugz":"","checkItems":0,"checkItemsChecked":0,"comments":0,"attachments":0,"description":false,"due":null},"checkItemStates":[],"closed":false,"dateLastActivity":"2016-01-18T11:19:48.559Z","desc":"","descData":null,"due":null,"email":"fuadyusuf_kh+52521456b9e7e63447002893+5546ec082574e4d5c369aa81+a415252dce4f51214d0cd000225a0c6d256abfe0@boards.trello.com","idBoard":"53cc963372426d78be85bff0","idChecklists":[],"idList":"53cc963372426d78be85bff2","idMembers":["52521456b9e7e63447002893"],"idMembersVoted":[],"idShort":22,"idAttachmentCover":null,"manualCoverAttachment":false,"labels":[{"id":"54655c1674d650d567173928","idBoard":"53cc963372426d78be85bff0","name":"good","color":"green","uses":2},{"id":"54655c1674d650d56717392b","idBoard":"53cc963372426d78be85bff0","name":"brave","color":"red","uses":2}],"idLabels":["54655c1674d650d56717392b","54655c1674d650d567173928"],"name":"test awan","pos":65535,"shortLink":"76BPgt0G","shortUrl":"https://trello.com/c/76BPgt0G","subscribed":true,"url":"https://trello.com/c/76BPgt0G/22-test-awan"},{"id":"569740fd5d737271b9afc852","badges":{"votes":0,"viewingMemberVoted":false,"subscribed":true,"fogbugz":"","checkItems":0,"checkItemsChecked":0,"comments":0,"attachments":0,"description":false,"due":"2016-01-19T15:00:00.000Z"},"checkItemStates":[],"closed":false,"dateLastActivity":"2016-01-19T05:17:00.704Z","desc":"","descData":null,"due":"2016-01-19T15:00:00.000Z","email":"fuadyusuf_kh+52521456b9e7e63447002893+569740fd5d737271b9afc852+a8d3111ec28f79404c66221ea960d89dfae66572@boards.trello.com","idBoard":"53cc963372426d78be85bff0","idChecklists":[],"idList":"53cc963372426d78be85bff2","idMembers":["52521456b9e7e63447002893"],"idMembersVoted":[],"idShort":48,"idAttachmentCover":null,"manualCoverAttachment":false,"labels":[],"idLabels":[],"name":"eiusmod labore ","pos":196607,"shortLink":"pKcwbqj4","shortUrl":"https://trello.com/c/pKcwbqj4","subscribed":true,"url":"https://trello.com/c/pKcwbqj4/48-eiusmod-labore"},{"id":"569740fe4596a9338720a16f","badges":{"votes":0,"viewingMemberVoted":false,"subscribed":true,"fogbugz":"","checkItems":0,"checkItemsChecked":0,"comments":0,"attachments":0,"description":false,"due":"2016-01-20T05:00:00.000Z"},"checkItemStates":[],"closed":false,"dateLastActivity":"2016-01-16T23:26:44.483Z","desc":"","descData":null,"due":"2016-01-20T05:00:00.000Z","email":"fuadyusuf_kh+52521456b9e7e63447002893+569740fe4596a9338720a16f+a140dcf4911c644ce47d3ab38f6261ddef6f89c5@boards.trello.com","idBoard":"53cc963372426d78be85bff0","idChecklists":[],"idList":"53cc963372426d78be85bff2","idMembers":["52521456b9e7e63447002893"],"idMembersVoted":[],"idShort":49,"idAttachmentCover":null,"manualCoverAttachment":false,"labels":[],"idLabels":[],"name":"adipisicing ipsum ","pos":262143,"shortLink":"TVsxUvgY","shortUrl":"https://trello.com/c/TVsxUvgY","subscribed":true,"url":"https://trello.com/c/TVsxUvgY/49-adipisicing-ipsum"},{"id":"569740ff175c86d85019d948","badges":{"votes":0,"viewingMemberVoted":false,"subscribed":true,"fogbugz":"","checkItems":0,"checkItemsChecked":0,"comments":0,"attachments":0,"description":false,"due":null},"checkItemStates":[],"closed":false,"dateLastActivity":"2016-01-16T23:26:50.471Z","desc":"","descData":null,"due":null,"email":"fuadyusuf_kh+52521456b9e7e63447002893+569740ff175c86d85019d948+c14ca5fecf4a7e5ca48081fd778fb0e026c81ef4@boards.trello.com","idBoard":"53cc963372426d78be85bff0","idChecklists":[],"idList":"53cc963372426d78be85bff2","idMembers":["52521456b9e7e63447002893"],"idMembersVoted":[],"idShort":50,"idAttachmentCover":null,"manualCoverAttachment":false,"labels":[],"idLabels":[],"name":"commodo veniam ","pos":327679,"shortLink":"C8dIS9FL","shortUrl":"https://trello.com/c/C8dIS9FL","subscribed":true,"url":"https://trello.com/c/C8dIS9FL/50-commodo-veniam"},{"id":"5546ec91773d62ae6db81943","badges":{"votes":0,"viewingMemberVoted":false,"subscribed":true,"fogbugz":"","checkItems":0,"checkItemsChecked":0,"comments":0,"attachments":0,"description":false,"due":"2016-03-12T05:00:00.000Z"},"checkItemStates":[],"closed":false,"dateLastActivity":"2016-01-16T23:27:37.738Z","desc":"","descData":null,"due":"2016-03-12T05:00:00.000Z","email":"fuadyusuf_kh+52521456b9e7e63447002893+5546ec91773d62ae6db81943+ba95251c38d1b1a074acb663428611d3f67c6473@boards.trello.com","idBoard":"53cc963372426d78be85bff0","idChecklists":[],"idList":"53cc963372426d78be85bff2","idMembers":["52521456b9e7e63447002893"],"idMembersVoted":[],"idShort":23,"idAttachmentCover":null,"manualCoverAttachment":false,"labels":[],"idLabels":[],"name":"Duis aute irure dolor in ","pos":131071,"shortLink":"MOlgiYjf","shortUrl":"https://trello.com/c/MOlgiYjf","subscribed":true,"url":"https://trello.com/c/MOlgiYjf/23-duis-aute-irure-dolor-in"},{"id":"56974101b579b1c706693ada","badges":{"votes":0,"viewingMemberVoted":false,"subscribed":true,"fogbugz":"","checkItems":0,"checkItemsChecked":0,"comments":0,"attachments":0,"description":false,"due":null},"checkItemStates":[],"closed":false,"dateLastActivity":"2016-01-16T23:27:03.560Z","desc":"","descData":null,"due":null,"email":"fuadyusuf_kh+52521456b9e7e63447002893+56974101b579b1c706693ada+26f4a3c429961efb649ba71ae6973ea83c40d562@boards.trello.com","idBoard":"53cc963372426d78be85bff0","idChecklists":[],"idList":"53cc963372426d78be85bff2","idMembers":["52521456b9e7e63447002893"],"idMembersVoted":[],"idShort":52,"idAttachmentCover":null,"manualCoverAttachment":false,"labels":[],"idLabels":[],"name":"Deserunt mollit ","pos":458751,"shortLink":"caoz6SUF","shortUrl":"https://trello.com/c/caoz6SUF","subscribed":true,"url":"https://trello.com/c/caoz6SUF/52-deserunt-mollit"},{"id":"56974103e92a115807f56883","badges":{"votes":0,"viewingMemberVoted":false,"subscribed":true,"fogbugz":"","checkItems":0,"checkItemsChecked":0,"comments":1,"attachments":0,"description":false,"due":null},"checkItemStates":[],"closed":false,"dateLastActivity":"2016-01-19T09:58:06.681Z","desc":"","descData":null,"due":null,"email":"fuadyusuf_kh+52521456b9e7e63447002893+56974103e92a115807f56883+4d1814c5da955c0fe8327ff215780549a8fa0f75@boards.trello.com","idBoard":"53cc963372426d78be85bff0","idChecklists":[],"idList":"53cc963372426d78be85bff2","idMembers":["52521456b9e7e63447002893"],"idMembersVoted":[],"idShort":53,"idAttachmentCover":null,"manualCoverAttachment":false,"labels":[{"id":"54655c1674d650d56717392b","idBoard":"53cc963372426d78be85bff0","name":"brave","color":"red","uses":2}],"idLabels":["54655c1674d650d56717392b"],"name":"Sunt in culpa qui officia ","pos":524287,"shortLink":"ZKxPwRiG","shortUrl":"https://trello.com/c/ZKxPwRiG","subscribed":true,"url":"https://trello.com/c/ZKxPwRiG/53-sunt-in-culpa-qui-officia"},{"id":"5697410452d09c6388884001","badges":{"votes":0,"viewingMemberVoted":false,"subscribed":true,"fogbugz":"","checkItems":0,"checkItemsChecked":0,"comments":0,"attachments":0,"description":false,"due":null},"checkItemStates":[],"closed":false,"dateLastActivity":"2016-01-16T23:27:16.076Z","desc":"","descData":null,"due":null,"email":"fuadyusuf_kh+52521456b9e7e63447002893+5697410452d09c6388884001+f1949f12f1b937f95024d97c3c02bfdd67d4f8f9@boards.trello.com","idBoard":"53cc963372426d78be85bff0","idChecklists":[],"idList":"53cc963372426d78be85bff2","idMembers":["52521456b9e7e63447002893"],"idMembersVoted":[],"idShort":54,"idAttachmentCover":null,"manualCoverAttachment":false,"labels":[],"idLabels":[],"name":"Excepteur sint occaecat ","pos":589823,"shortLink":"Wr2AQIke","shortUrl":"https://trello.com/c/Wr2AQIke","subscribed":true,"url":"https://trello.com/c/Wr2AQIke/54-excepteur-sint-occaecat"},{"id":"56974106045849bea2962adc","badges":{"votes":0,"viewingMemberVoted":false,"subscribed":true,"fogbugz":"","checkItems":0,"checkItemsChecked":0,"comments":0,"attachments":0,"description":false,"due":null},"checkItemStates":[],"closed":false,"dateLastActivity":"2016-01-19T09:58:14.493Z","desc":"","descData":null,"due":null,"email":"fuadyusuf_kh+52521456b9e7e63447002893+56974106045849bea2962adc+595955733f0bb4ca73d7ef689445b7fe28449440@boards.trello.com","idBoard":"53cc963372426d78be85bff0","idChecklists":[],"idList":"53cc963372426d78be85bff2","idMembers":["52521456b9e7e63447002893"],"idMembersVoted":[],"idShort":55,"idAttachmentCover":null,"manualCoverAttachment":false,"labels":[{"id":"54655c1674d650d567173929","idBoard":"53cc963372426d78be85bff0","name":"","color":"yellow","uses":1}],"idLabels":["54655c1674d650d567173929"],"name":"Anim id est laborum ","pos":655359,"shortLink":"BjeiMHAa","shortUrl":"https://trello.com/c/BjeiMHAa","subscribed":true,"url":"https://trello.com/c/BjeiMHAa/55-anim-id-est-laborum"},{"id":"569c3c97e1a30daeaa79e6fd","badges":{"votes":0,"viewingMemberVoted":false,"subscribed":true,"fogbugz":"","checkItems":5,"checkItemsChecked":4,"comments":0,"attachments":0,"description":false,"due":null},"checkItemStates":[{"idCheckItem":"569c3c97e1a30daeaa79e713","state":"complete"},{"idCheckItem":"569c3c97e1a30daeaa79e714","state":"complete"},{"idCheckItem":"569c3c97e1a30daeaa79e715","state":"complete"},{"idCheckItem":"569c3c97e1a30daeaa79e717","state":"complete"}],"closed":false,"dateLastActivity":"2016-01-22T03:50:36.473Z","desc":"","descData":null,"due":null,"email":"fuadyusuf_kh+52521456b9e7e63447002893+569c3c97e1a30daeaa79e6fd+e8a764fb0fe1a2508767312ba28c0d5be0918679@boards.trello.com","idBoard":"569c3ca9ed7fefb5c6b1b549","idChecklists":["569c3c97e1a30daeaa79e712"],"idList":"569c3cc99a96ffb8eff0ebbd","idMembers":["52521456b9e7e63447002893"],"idMembersVoted":[],"idShort":2,"idAttachmentCover":null,"manualCoverAttachment":false,"labels":[],"idLabels":[],"name":"Day 5 - jQuery","pos":524287,"shortLink":"sE5p1QyR","shortUrl":"https://trello.com/c/sE5p1QyR","subscribed":true,"url":"https://trello.com/c/sE5p1QyR/2-day-5-jquery"}]},"To Confirm":{"regex":{},"items":[{"id":"55481ebb83362e1a96952d75","badges":{"votes":0,"viewingMemberVoted":false,"subscribed":true,"fogbugz":"","checkItems":0,"checkItemsChecked":0,"comments":0,"attachments":0,"description":false,"due":null},"checkItemStates":[],"closed":false,"dateLastActivity":"2015-05-05T01:37:00.967Z","desc":"","descData":null,"due":null,"email":"fuadyusuf_kh+52521456b9e7e63447002893+55481ebb83362e1a96952d75+5eb3cde2a33474327b115363bc952c9f27d193ee@boards.trello.com","idBoard":"53cc963372426d78be85bff0","idChecklists":[],"idList":"55481eadc2db88724d7234f6","idMembers":["52521456b9e7e63447002893"],"idMembersVoted":[],"idShort":25,"idAttachmentCover":null,"manualCoverAttachment":false,"labels":[],"idLabels":[],"name":"please confirm 1","pos":65535,"shortLink":"cYvZZWkC","shortUrl":"https://trello.com/c/cYvZZWkC","subscribed":true,"url":"https://trello.com/c/cYvZZWkC/25-please-confirm-1"},{"id":"55481ec110fac749c243a7c6","badges":{"votes":0,"viewingMemberVoted":false,"subscribed":true,"fogbugz":"","checkItems":0,"checkItemsChecked":0,"comments":0,"attachments":0,"description":false,"due":"2015-10-17T05:00:00.000Z"},"checkItemStates":[],"closed":false,"dateLastActivity":"2016-01-19T06:06:42.903Z","desc":"","descData":null,"due":"2015-10-17T05:00:00.000Z","email":"fuadyusuf_kh+52521456b9e7e63447002893+55481ec110fac749c243a7c6+3a0c887d9c847fdf23b0c3b7840d8c0720b767b3@boards.trello.com","idBoard":"53cc963372426d78be85bff0","idChecklists":[],"idList":"55481eadc2db88724d7234f6","idMembers":["52521456b9e7e63447002893"],"idMembersVoted":[],"idShort":26,"idAttachmentCover":null,"manualCoverAttachment":false,"labels":[],"idLabels":[],"name":"again","pos":262143,"shortLink":"Lc8azxwG","shortUrl":"https://trello.com/c/Lc8azxwG","subscribed":true,"url":"https://trello.com/c/Lc8azxwG/26-again"},{"id":"554c2ec9b9f61a43a00607b4","badges":{"votes":0,"viewingMemberVoted":false,"subscribed":true,"fogbugz":"","checkItems":0,"checkItemsChecked":0,"comments":0,"attachments":0,"description":false,"due":null},"checkItemStates":[],"closed":false,"dateLastActivity":"2016-01-16T23:28:16.607Z","desc":"","descData":null,"due":null,"email":"fuadyusuf_kh+52521456b9e7e63447002893+554c2ec9b9f61a43a00607b4+a18eb7eaf3deebd887a2bee049f53ebbf904d201@boards.trello.com","idBoard":"53cc963372426d78be85bff0","idChecklists":[],"idList":"55481eadc2db88724d7234f6","idMembers":["52521456b9e7e63447002893"],"idMembersVoted":[],"idShort":29,"idAttachmentCover":null,"manualCoverAttachment":false,"labels":[],"idLabels":[],"name":"officia nulla deserunt ","pos":327679,"shortLink":"C17tJRkw","shortUrl":"https://trello.com/c/C17tJRkw","subscribed":true,"url":"https://trello.com/c/C17tJRkw/29-officia-nulla-deserunt"}]},"To Upload":{"regex":{},"items":[]},"Sandbox":{"regex":{},"items":[]},"Live Check":{"regex":{},"items":[{"id":"55481ed05b3ccb966e46a6dc","badges":{"votes":0,"viewingMemberVoted":false,"subscribed":true,"fogbugz":"","checkItems":0,"checkItemsChecked":0,"comments":0,"attachments":0,"description":false,"due":null},"checkItemStates":[],"closed":false,"dateLastActivity":"2016-01-16T23:25:26.852Z","desc":"","descData":null,"due":null,"email":"fuadyusuf_kh+52521456b9e7e63447002893+55481ed05b3ccb966e46a6dc+f5cb0429e8cc9b480b7ab154ead63efa9d5e163f@boards.trello.com","idBoard":"53cc963372426d78be85bff0","idChecklists":[],"idList":"554821b6bc39f82fee42153b","idMembers":["52521456b9e7e63447002893"],"idMembersVoted":[],"idShort":27,"idAttachmentCover":null,"manualCoverAttachment":false,"labels":[],"idLabels":[],"name":"is it done right?","pos":196607,"shortLink":"4pXKgiS6","shortUrl":"https://trello.com/c/4pXKgiS6","subscribed":true,"url":"https://trello.com/c/4pXKgiS6/27-is-it-done-right"}]},"Other":{"regex":{},"items":[{"id":"55ff611573e63bbec28e2bbd","badges":{"votes":0,"viewingMemberVoted":false,"subscribed":true,"fogbugz":"","checkItems":0,"checkItemsChecked":0,"comments":0,"attachments":0,"description":false,"due":null},"checkItemStates":[],"closed":false,"dateLastActivity":"2015-10-23T07:30:17.044Z","desc":"","descData":null,"due":null,"email":"fuadyusuf_kh+52521456b9e7e63447002893+55ff611573e63bbec28e2bbd+c2023445228a067d5dd23db7e06122e65b477a87@boards.trello.com","idBoard":"52dcc54f5585ca617a7b377f","idChecklists":[],"idList":"5327ca291ae0c5090f687a0a","idMembers":["52521456b9e7e63447002893"],"idMembersVoted":[],"idShort":197,"idAttachmentCover":null,"manualCoverAttachment":false,"labels":[],"idLabels":[],"name":"Magazine Engine - Parent Child Theme","pos":18975.990112304688,"shortLink":"dh8K11go","shortUrl":"https://trello.com/c/dh8K11go","subscribed":true,"url":"https://trello.com/c/dh8K11go/197-magazine-engine-parent-child-theme"},{"id":"569757b3adabd03227765cb8","badges":{"votes":0,"viewingMemberVoted":false,"subscribed":true,"fogbugz":"","checkItems":21,"checkItemsChecked":9,"comments":2,"attachments":5,"description":true,"due":null},"checkItemStates":[{"idCheckItem":"5697593402901f5df30a927f","state":"complete"},{"idCheckItem":"56975935ce5f3a0da136081e","state":"complete"},{"idCheckItem":"5697593602901f5df30a9284","state":"complete"},{"idCheckItem":"569759362ed275c700419163","state":"complete"},{"idCheckItem":"569759374c0f8ff129d3707b","state":"complete"},{"idCheckItem":"569c6c2bde06e37abc6ee2dc","state":"complete"},{"idCheckItem":"569c6cc50316a148a6587b1c","state":"complete"},{"idCheckItem":"569c6cd46e26f9a956bd996d","state":"complete"},{"idCheckItem":"569c86bb112cf4520c22427f","state":"complete"}],"closed":false,"dateLastActivity":"2016-01-20T01:09:12.185Z","desc":"http://dev.krafthaus.co.id/kh_tools/insys/mytrellocards","descData":{"emoji":{}},"due":null,"email":"fuadyusuf_kh+52521456b9e7e63447002893+569757b3adabd03227765cb8+90c8acc1842b37de4e7af753df287b648f053ebd@boards.trello.com","idBoard":"52dcc54f5585ca617a7b377f","idChecklists":["5697593349cdbc19b347ff21","569c6bf669b1e73b2b1c254c"],"idList":"5629e345d048d01120a4f19c","idMembers":["52521456b9e7e63447002893"],"idMembersVoted":[],"idShort":198,"idAttachmentCover":"5697593c433754da135253a8","manualCoverAttachment":false,"labels":[],"idLabels":[],"name":"Krafthaus My Trello Cards","pos":65535,"shortLink":"JiVtrYzt","shortUrl":"https://trello.com/c/JiVtrYzt","subscribed":true,"url":"https://trello.com/c/JiVtrYzt/198-krafthaus-my-trello-cards"},{"id":"55cc5b9781095b9d4cd228cd","badges":{"votes":0,"viewingMemberVoted":false,"subscribed":true,"fogbugz":"","checkItems":7,"checkItemsChecked":0,"comments":5,"attachments":1,"description":false,"due":null},"checkItemStates":[],"closed":false,"dateLastActivity":"2015-10-05T04:36:34.539Z","desc":"","descData":null,"due":null,"email":"fuadyusuf_kh+52521456b9e7e63447002893+55cc5b9781095b9d4cd228cd+c5d4a703d55f1cc749bf6bd6ec33b3935b9d125b@boards.trello.com","idBoard":"538e9474e9270cb143b1ab9e","idChecklists":["55cc5bf7b7999bd782251537","55cc5d40f4d7e7e32fa806f3","55d3dca45b3f9fe475a72162"],"idList":"54dae179b313667abade6649","idMembers":["50272dc23c55422a1423c55a","51abed2947b1665137002d92","52521456b9e7e63447002893"],"idMembersVoted":[],"idShort":301,"idAttachmentCover":null,"manualCoverAttachment":false,"labels":[{"id":"5464e90974d650d567b8eb0f","idBoard":"538e9474e9270cb143b1ab9e","name":"Hi Prio","color":"red","uses":18}],"idLabels":["5464e90974d650d567b8eb0f"],"name":"Project Backlog","pos":720895,"shortLink":"hZlws4P9","shortUrl":"https://trello.com/c/hZlws4P9","subscribed":true,"url":"https://trello.com/c/hZlws4P9/301-project-backlog"},{"id":"56984ec2af275688fecbba8f","badges":{"votes":0,"viewingMemberVoted":false,"subscribed":true,"fogbugz":"","checkItems":0,"checkItemsChecked":0,"comments":4,"attachments":0,"description":false,"due":null},"checkItemStates":[],"closed":false,"dateLastActivity":"2016-01-18T02:32:45.621Z","desc":"","descData":null,"due":null,"email":"fuadyusuf_kh+52521456b9e7e63447002893+56984ec2af275688fecbba8f+8c2bc1b8f724677c616c1fd05025ef650cd737d0@boards.trello.com","idBoard":"5608c446b1df9c1e98e3d1df","idChecklists":[],"idList":"560b186e1c70ba50198f2ab4","idMembers":["52521456b9e7e63447002893","55519f07213d066f64ac7638"],"idMembersVoted":[],"idShort":20,"idAttachmentCover":null,"manualCoverAttachment":false,"labels":[],"idLabels":[],"name":"PRD Week 12","pos":65535,"shortLink":"sVHlqsF7","shortUrl":"https://trello.com/c/sVHlqsF7","subscribed":true,"url":"https://trello.com/c/sVHlqsF7/20-prd-week-12"},{"id":"568c5794c01789eb3340c39e","badges":{"votes":0,"viewingMemberVoted":false,"subscribed":true,"fogbugz":"","checkItems":0,"checkItemsChecked":0,"comments":5,"attachments":0,"description":false,"due":null},"checkItemStates":[],"closed":false,"dateLastActivity":"2016-01-15T01:43:22.319Z","desc":"","descData":null,"due":null,"email":"fuadyusuf_kh+52521456b9e7e63447002893+568c5794c01789eb3340c39e+61faf0da2d783d4e370af9315dc5c7da524e0ef7@boards.trello.com","idBoard":"5608c446b1df9c1e98e3d1df","idChecklists":[],"idList":"560b187d88d7cd281998bae4","idMembers":["4ea12c6a97185d4e160d87fe","52521456b9e7e63447002893","55519f07213d066f64ac7638"],"idMembersVoted":[],"idShort":19,"idAttachmentCover":null,"manualCoverAttachment":false,"labels":[],"idLabels":[],"name":"PRD - Week 11","pos":511.9921875,"shortLink":"gv0y7qcj","shortUrl":"https://trello.com/c/gv0y7qcj","subscribed":true,"url":"https://trello.com/c/gv0y7qcj/19-prd-week-11"}]}};

				dom_events();

				$(document).off('visibilitychange');

				self.render();

				return false;
			}

			if(window.Trello)
			{
				Trello.authorize({
					type       : "redirect",
					name       : "Krafthaus Tools - My Trello Cards",
					scope      : {
						read    : true,
						write   : true,
						account : true,
					},
					expiration : "never",
					success    : function (argument) {
						console.log('Trello Connected');
						self.main();
						dom_events();
						self.ga_send();
					},
					error      : function (argument) {
						console.log('Trello Connect Failed');
					}
				});
			}
			else
			{
				var loading     = $('.content .loading');
				var loading_bar = $('.content .loading .bar');
				var loading_msg = $('.content .loading .message');

				loading_bar.css('width', '100%');
				loading_msg.text('Can\'t connect to Trello, please try again later.');
			}
		},
		refresh: function() {
			var self = this;

			$.each(categories, function(index, val) {
				categories[index].items = [];
			});

			$('.content .list').each(function(index, el) {
				$(this).fadeOut(300, function() {
					$(this).remove();
				});
			});

			$('.content .loading .bar').css('width', '0%');
			$('.content .loading').fadeIn();

			self.main();

			apply_settings();
		},
		main: function() {
			var self = this;
			var loading = $('.content .loading');
			var loading_bar = $('.content .loading .bar');
			var loading_msg = $('.content .loading .message');

			Trello.members.get('me').done(function(data) {
				engine_cache.me = data;
			});

			var m;
			var member_id = (m = /^member-(.*)/.exec( location.hash.replace('#','') )) ? m[1] : '';
			get_my_cards(member_id)
				.progress(function(p, message) {
					console.log(p, message);
					loading_bar.css('width', p + '%');
					loading_msg.text(message);
				})
				.done(function(cards) {

					/* categorize cards */
					categorize_cards(cards);

					save_cache(engine_cache, cards);

					self.render();
				})
				.fail(function() {
					Trello.deauthorize();
					window.location.reload();
				});
		},
		render: function() {
			var list_template = $('.list-template').clone().removeClass('list-template');
			var loading = $('.content .loading');
			var loading_bar = $('.content .loading .bar');
			var loading_msg = $('.content .loading .message');

			console.log(categories);

			$('.content .scroll').html('');

			$.each(categories, function(index, category) {
				category.items.sort(sort_by_board);

				var list       = list_template.clone().css('display', 'none');
				var listscroll = list.find('.list-scroll');
				list.find('.list-name .name').text(index);
				// list.find('.list-name .count').text(category.items.length);

				var render_list_name = /other/i.test(index);

				$.each(category.items, function(i, item) {
					var card = render_card(item, render_list_name);

					listscroll.append(card);
				});

				$('.content .scroll').append(list);
			});

			setTimeout(function() {
				loading.fadeOut(400, function(argument) {
					$('.content .scroll .list').fadeIn();
					$('.list').trigger('recount');
				});
			}, 500);
		},
		ga_send: function() {
			Trello.members.get('me',function(user){
				ga('set', 'dimension1', user.username);
				ga('send', 'pageview');
			});
		},
		backup_settings: function() {
			var settings = JSON.parse(localStorage.getItem('mytrellocards-setting'));
			var expires  = JSON.parse(localStorage.getItem('mytrellocards-hide-card-expires')) || {};
			var now      = new Date();
			var date     = now.getDate() + '-' + now.getMonth() + 1 + '-' + now.getFullYear();
			var filename = 'mytrellocards-setting-' + date + '.json';

			download_json([settings, expires], filename);
		}
	};

	return MyTrelloCards;
}());

$(document).ready(function() {
	MyTrelloCards.init();
});