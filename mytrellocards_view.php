<?php
$page_title = 'My Trello Cards';
$asset_url = 'assets/';
$base_url = '';
$color;
define('APP_KEY', '579e8ef7d4f561f75d9e268ea01ad1f1');
define('APP_SECRET', '73e3f617c4f0d4139fd0639f875b073bb887a9b065e3e626de8b2bd89b542871');
?>
<!DOCTYPE html>
<html>

<head>
	<title><?php echo $page_title ?></title>
	<meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no, minimum-scale=1.0, maximum-scale=1.0">
	<link rel="stylesheet" type="text/css" href="<?php echo $asset_url . 'css/fa/css/font-awesome.css' ?>">
	<link rel="stylesheet" type="text/css" href="<?php echo $asset_url . 'css/jquery.datetimepicker.css' ?>">
	<link rel="stylesheet" type="text/css" href="<?php echo $asset_url . 'css/flatpickr.min.css' ?>">
	<link rel="stylesheet" type="text/css" href="<?php echo $asset_url . 'css/style.css' ?>">
	<style type="text/css" id="css-dynamic"></style>

	<script src="https://cdnjs.cloudflare.com/ajax/libs/jquery/1.12.4/jquery.min.js" type="text/javascript"></script>
</head>

<body>
	<script>
		var settings = JSON.parse(localStorage.getItem('mytrellocards-setting'));
		if (settings) {
			if (settings['bg-image']) {
				$('body').css('background-image', 'url(' + settings['bg-image'] + ')');
			}
			if (settings['bg-color']) {
				$('body').css('background-color', settings['bg-color']);
			}
		}
	</script>

	<div class="header">
		<img src="<?php echo $asset_url . 'img/kh-long-logo-white.png' ?>" alt="KH Logo" class="kh-logo">
		<h1>
			<a href="<?php echo $base_url ?>" title="Krafthaus Tool">
				<span>Krafthaus Tools</span>
			</a>
		</h1>
	</div>

	<div class="sub-header">
		<div class="right-panel">
			<div class="hidden-items">
				<i class="fa fa-warning"></i>
				<span>You hide 2 boards and 4 cards</span>
			</div>
			<div class="refresh">
				<i class="fa fa-refresh"></i> Refresh
			</div>
			<div class="setting" style="margin-right: 0.5em">
				<i class="fa fa-gear"></i> Settings
			</div>
		</div>
		<h2>Krafthaus Tools - My Trello Cards</h2>
		<span class="help-btn" title="Help">
			<i class="fa fa-question-circle"></i>
		</span>
		<span class="notif-btn" title="Notifications">
			<i class="fa fa-info-circle"></i>
		</span>
		<div class="filter-box">
			<input class="input-filter" type="text" name="search" value="" placeholder="Filter cards">
			<i class="fa fa-remove" title="Clear filter"></i>
		</div>
		<span class="member-btn"></span>
	</div>

	<div class="content">

		<div class="scroll">
		</div>

		<div class="loading">
			<div class="progress">
				<div class="bar"></div>
			</div>
			<div class="message">Connecting to Trello..</div>
		</div>

		<div class="card-menu-list">
			<div class="menu-item hide-card" data-duration="<?php echo 1000 * 60 * 60 * 4 ?>">Hide for 4 hours</div>
			<div class="menu-item hide-card" data-duration="<?php echo 1000 * 60 * 60 * 24 * 2 ?>">Hide for 2 days</div>
			<div class="menu-item hide-card" data-duration="<?php echo 1000 * 60 * 60 * 24 * 6 ?>">Hide for 6 days</div>
			<div class="menu-item hide-card" data-duration="<?php echo 1000 * 60 * 60 * 24 * 13 ?>">Hide for 2 weeks</div>
			<div class="menu-item hide-card" data-duration="<?php echo 1000 * 60 * 60 * 24 * 30 ?>">Hide for 1 month</div>
			<div class="menu-item hide-card" data-duration="0">Hide forever</div>
			<div class="menu-item hide-card-until" data-duration="0">Hide until..</div>
			<div class="hide-date-picker">
				<div class="date-picker"></div>
				<div class="hide-custom-btn">
					Hide
				</div>
			</div>
		</div>

	</div>

	<div class="modal modal-setting">
		<div class="modal-backdrop"></div>
		<div class="modal-scroll">
			<div class="modal-content">
				<div class="modal-header">
					<span class="title">My Trello Cards Settings</span>
					<i class="fa fa-chevron-down modal-option-btn"></i>
					<div class="modal-menu-list">
						<div class="menu-item backup-settings">Backup Settings..</div>
						<div class="menu-item restore-settings">
							Restore Settings..
							<input type="file" name="input-settings" accept=".json">
						</div>
					</div>
				</div>
				<form action="" method="get" accept-charset="utf-8" id="form-setting">

					<div class="setting-item">
						<strong class="label inline">Custom Background Color</strong>
						<input type="color" name="bg-color" class="input-color" value="#2b6c91">
					</div>
					<div class="setting-item">
						<strong class="label">Custom Background Image</strong>
						<div class="input-text">
							<input type="text" name="bg-image" value="" placeholder="http://example.com/background.jpg">
						</div>
					</div>
					<div class="setting-item">
						<strong class="label">Hide selected boards:</strong>
						<div class="select-boards">
						</div>
					</div>
					<div class="setting-item">
						<strong class="label">Hidden cards:</strong>
						<div class="hidden-cards-groups">
						</div>
					</div>
					<div class="setting-item">
						<strong class="label">Custom lists:</strong>
						<span class="custom-list-info">* custom lists need refresh to take effects</span>
						<div class="custom-lists">
						</div>
						<button type="button" class="add-custom-list-btn">add custom list</button>
						<button type="button" class="reset-custom-list-btn">reset to default</button>
					</div>
					<div class="setting-item">
						<strong class="label">Label priority:</strong>
						<div class="label-priority">
							<?php $colors = array('red', 'orange', 'yellow', 'green', 'purple', 'black', 'blue', 'lime', 'pink', 'sky') ?>
							<?php foreach ($colors as $key => $color) : ?>
								<div class="label-item" data-color="<?php echo $color ?>">
									<div class="color <?php echo $color ?>"></div>
									<input type="hidden" name="label-priority[]" value="<?php echo $color ?>">
								</div>
							<?php endforeach ?>
						</div>
					</div>

				</form>
				<div class="modal-footer">
					<button class="button save">Save</button>
					<button class="button close">Close</button>
				</div>

			</div>
		</div>
	</div>

	<div class="modal modal-help">
		<div class="modal-backdrop"></div>
		<div class="modal-scroll">
			<div class="modal-content">
				<div class="modal-header">
					<span class="title">What is My Trello Cards?</span>
				</div>

				<div class="help-content">
					<p>
						<strong>My Trello Cards</strong> is a tool to help you check all your cards on <a href="https://trello.com">Trello</a>. It will organise your cards into few categories:
						<strong>To Do</strong>,
						<strong>Doing</strong>,
						<strong>To Confirm</strong>,
						<strong>To Upload</strong>,
						<strong>Sandbox Check</strong> &amp;
						<strong>Live check</strong>.
						Any other cards that are not categorised on those types will appear on <strong>Other</strong> by default. If you know regex you can costumise your own list on settings panel, re-order as you want.
					</p>
					<hr>
					<p>
						You can hide some boards or even specific cards that you don't want to appear on this tool. To hide boards, open <strong>Settings</strong> panel and check the board name on <strong>Hide selected boards</strong> section.
					</p>
					<hr>
					<p>
						To hide specific cards, select which cards do you want to hide and click <i class="fa fa-chevron-down"></i> icon on the top right of the card to show hide menu options. If you want to show that card again, you can do it from <strong>Settings</strong> panel.
					</p>
					<hr>
					<p>
						Various other options can be found on <strong>Settings</strong> panel such as <strong>Custom Background Color</strong> &amp; <strong>Image</strong>, <strong>Label priority</strong> order, <strong>Backup</strong> &amp; <strong>Restore</strong> settings and so on.
					</p>
					<hr>
					<div class="credit">
						<div>
							by <a href="https://trello.com/fuadyusuf_kh" title="Fuad Yusuf" target="_blank">fuadyusuf_kh</a>
						</div>
						If you found this tool helpfull, enjoy it :)
					</div>
				</div>

			</div>
		</div>
	</div>

	<div class="modal modal-notif">
		<div class="modal-backdrop"></div>
		<div class="modal-scroll">
			<div class="modal-content">
				<div class="modal-header">
					<span class="title">Trello notifications</span>
					<button class="button read-all">Mark all as read</button>
				</div>

				<div class="notif-content">
				</div>

			</div>
		</div>
	</div>

	<div class="modal modal-member">
		<div class="modal-backdrop"></div>
		<div class="modal-scroll">
			<div class="modal-content">
				<div class="modal-header">
					<span class="title">Our Members</span>
				</div>

				<div class="member-content">
				</div>

			</div>
		</div>
	</div>

	<div class="list list-template">
		<div class="list-header">
			<div class="list-sort">
				<select title="Sort by">
					<option value="board">Board</option>
					<option value="due">Due Date</option>
					<option value="name">Alphabet</option>
					<option value="label">Label</option>
				</select>
			</div>
			<div class="list-name">
				<span class="name">To Do</span>
				(<span class="count"></span>)
			</div>
		</div>
		<div class="list-scroll-wrap">
			<div class="list-scroll"></div>
		</div>
		<div class="list-footer">
			<span>Open all cards above</span>
		</div>
	</div>

	<script type="text/template" id="custom-list-template">
		<div class="custom-list">
			<i class="fa fa-reorder sort-handle"></i>
			<div class="input-text">
				<input type="text" name="custom-list[][name]" value="" placeholder="List name" class="name">
			</div>
			<div class="input-text">
				<input type="text" name="custom-list[][regex]" value="" placeholder="list.*regex" class="regex">
			</div>
			<input type="hidden" name="custom-list[][default]" value="" placeholder="List name" class="default">
			<i class="fa fa-remove btn-remove" title="remove this item"></i>
		</div>
	</script>

	<script src="https://api.trello.com/1/client.js?key=<?php echo APP_KEY ?>" type="text/javascript"></script>
	<script src="<?php echo $asset_url . 'js/dragscrollable.js' ?>" type="text/javascript"></script>
	<script src="<?php echo $asset_url . 'js/jquery.serializejson.min.js' ?>" type="text/javascript"></script>
	<script src="<?php echo $asset_url . 'js/Sortable.js' ?>" type="text/javascript"></script>
	<script src="<?php echo $asset_url . 'js/jquery.datetimepicker.full.min.js' ?>" type="text/javascript"></script>
	<script src="<?php echo $asset_url . 'js/flatpickr.js' ?>" type="text/javascript"></script>
	<script src="https://cdnjs.cloudflare.com/ajax/libs/moment.js/2.24.0/moment.min.js" type="text/javascript"></script>
	<script type="text/javascript">
		var engine_global = <?php echo json_encode($engine_global) ?>;

		(function(i, s, o, g, r, a, m) {
			i['GoogleAnalyticsObject'] = r;
			i[r] = i[r] || function() {
				(i[r].q = i[r].q || []).push(arguments)
			}, i[r].l = 1 * new Date();
			a = s.createElement(o),
				m = s.getElementsByTagName(o)[0];
			a.async = 1;
			a.src = g;
			m.parentNode.insertBefore(a, m)
		})(window, document, 'script', '//www.google-analytics.com/analytics.js', 'ga');

		if (window.location.host == 'localhost') {
			ga('create', 'UA-56618897-2', {
				'cookieDomain': 'none'
			});
		} else {
			ga('create', 'UA-56618897-1', 'auto');
		}
	</script>
	<script src="<?php echo $asset_url . 'js/engine.js?ver=2017.02.28' ?>" type="text/javascript"></script>
</body>

</html>