/**!
 * wpMenuEditor
 * @author  Idoenk   <1d03nk@gmail.com> 2021
 * @license MIT
 */

// Uses CommonJS, AMD or browser globals to create a jQuery plugin.
;(function (factory) {
    if (typeof define === 'function' && define.amd) {
        // AMD. Register as an anonymous module.
        define(['jquery'], factory);
    } else if (typeof module === 'object' && module.exports) {
        // Node/CommonJS
        module.exports = function( root, jQuery ) {
            if ( jQuery === undefined ) {
                // require('jQuery') returns a factory that requires window to
                // build a jQuery instance, we normalize how we use modules
                // that require this pattern but the window provided is a noop
                // if it's defined (how jquery works)
                if ( typeof window !== 'undefined' ) {
                    jQuery = require('jquery');
                }
                else {
                    jQuery = require('jquery')(root);
                }
            }
            factory(jQuery, window, document);
            return jQuery;
        };
    } else {
        // Browser globals
        factory(jQuery, window, document);
    }
}(function($, window, document, undefined) {

    var pluginName = 'wpMenuEditor',
        defaults = {
            always_show_url: false,
            inline_addmenu: true,
            max_depth: 2,
            btn_addmenu_selector: '.wpmenu-accordion .btn-addmenu',

            /**
             * Custom data collector before add menu
             * Scope this: .wpmenu-accordion-body
             *
             * return Array of data menus
             */
            // addMenuDataCollector: function(data) { return data },

            /**
             * Custom event on menu added
             * Scope: .wpmenu-editor
             *
             * @return void
             */
            // onMenuAdded: function(e, $item) {  },
        }
    ;


    // # Helpers #
    var Utils = {
        /**
         * Returns a random integer between min (inclusive) and max (inclusive).
         * The value is no lower than min (or the next integer greater than min
         * if min isn't an integer) and no greater than max (or the next integer
         * lower than max if max isn't an integer).
         * Using Math.round() will give you a non-uniform distribution!
         *
         * @source: https://stackoverflow.com/a/1527834
         */
        getRandomInt(min, max) {
            min = Math.ceil(min);
            max = Math.floor(max);
            return Math.floor(Math.random() * (max - min + 1)) + min;
        },
    };
    // end Utils

    // Console log helper
    function clog(x){ console.warn(x) }


    /**
     * The plugin constructor
     * @param {DOM Element} element The DOM element where plugin is applied
     * @param {Object} options Options passed to the constructor
     */
    function Plugin(element, options) {

        // Hold sortable state
        this.sortable = null;

        // Store a reference to the source element
        this.el = element;

        // Store a jQuery reference  to the source element
        this.$el = $(element);

        // Set the instance options extending the plugin defaults and
        // the options passed by the user
        this.options = $.extend({}, $.fn[pluginName].defaults, options);

        // Initialize the plugin instance
        this.init();
    }

    /**
     * Set up your Plugin prototype with desired methods.
     * It is a good practice to implement 'init' and 'destroy' methods.
     */
    Plugin.prototype = {
        /**
         * Initialize the plugin instance.
         * Set any other attribtes, store any other element reference, register 
         * listeners, etc
         *
         * When bind listerners remember to name tag it with your plugin's name.
         * Elements can have more than one listener attached to the same event
         * so you need to tag it to unbind the appropriate listener on destroy:
         * 
         * @example
         * this.$someSubElement.on('click.' + pluginName, function() {
         *      // Do something
         * });
         *         
         */
        init: function() {
            // Check for dependency
            if ('function' !== typeof Sortable){
                console.error('Missing required package: Sortable. see: https://cdnjs.com/libraries/Sortable/1.13.0');
                return !1;
            }

            if (!this.options.menus){
                this.options.menus = this.$el.data('menus') || [];
            }

            this._renderMenu.call(this);

            this._inserterEvents();

            var instance = this;
            this.$el.bind('wpmenu:added', function(e, item){
                if ('function' == typeof instance.options.onMenuAdded)
                    instance.options.onMenuAdded.call(instance, e, $(item));
            })
        },

        /**
         * Public method to add menu
         * @param Array data of menu to add
         * @param Integer|undefined depth of menu
         * 
         * @example:
         * $('#element').wpMenuEditor('add', [{'url':'#', 'text':'Google'}])
         * 
         * @return void
         */
        add: function(data, menu_depth){
            var instance = this;

            if (!(data && data.length))
                return !1;

            if (!menu_depth)
                menu_depth = 0;

            for (var i=0, iL=data.length; i<iL; i++){
                var item_data = data[i];
                var $menu_item = this._templateMenu.call(this, item_data, menu_depth);

                this._addMenu.call(this, $menu_item, false);

                this.$el.trigger('wpmenu:added', $menu_item);

                // has submenu?
                if (item_data.submenu && item_data.submenu.length)
                    this.add.call(this, item_data.submenu, (menu_depth + 1));
            }

            setTimeout(function(){
                instance._update.call(instance);
            }, 345)
        },

        /**
         * Public method to load data menus
         * An alias for to add menus
         * @param Array data of menu to load
         *
         * return void
         */
        load: function(data) {

            this.add.call(this, data);
        },

        /**
         * Public method get data from rendered menus
         * @param {String} type Desired data output.
         * Eg. object, string. Default: string
         * 
         * @example:
         * $('#element').wpMenuEditor('data', 'object')
         * 
         * @return Object|String Data menus
         */
        data: function(type) {
            var data = this._collectDataMenus.call(this);

            if (type === 'object')
                return data;
            else
                return JSON.stringify(data);
        },


        // -------
        // Private
        // -------


        /**
         * Render html menus data to this.$el
         *
         * @return void
         */
        _renderMenu: function() {
            var menus = this.options.menus;

            var $item = null,
                html = '';

            if (menus && menus.length){

                this.add.call(this, menus);
            }

            // render btn inline-addmenu
            if (this.options.inline_addmenu){
                html = ''
                    +'<div class="wrap-inline-action">'
                    +   '<button type="button" class="btn btn-xs btn-secondary btn-inline-addmenu" data-act="add-menu" title="Quick add link menu">+</button>'
                    +'</div>'
                ;
                this.$el.after(html);
            }

            this._update.call(this);
        },

        /**
         * Trigger _menuEvents assignment & update sortable
         *
         * @return void
         */
        _update: function() {
            var instance = this;

            // Events
            // menu toggle
            this._menuEvents.call(this);

            this._prepareRestructureMenu.call(this);

            // sortable
            if (!this.sortable){
                setTimeout(function(){
                    instance._sortable.call(instance);
                }, 345);
            }
            else{
                this.$el.trigger('sortupdate');
            }
        },

        /**
         * Prepare render html menu of given data
         * @param {Array} data The data menu list containing object with key: url, text
         * @param {Integer} menu_depth The integer depth of menu or submenu
         *
         * @retun Object item
         */
        _templateMenu: function(data, menu_depth){
            var $item = null,
                random_id = null,
                html_inner_menu = '';

            data = data || {};

            // if (!data.id)
            //     data.id = Utils.getRandomInt(1, 99999);
            random_id = Utils.getRandomInt(1, 99999);

            if (!data.type)
                data.type = 'link';

            if (!menu_depth)
                menu_depth = 0;

            // Menu base-template
            $item = $(''
                +'<li class="menu-item"'+(menu_depth ? ' data-wpmenu_depth style="--wpmenu_depth:'+parseInt(menu_depth)+'"':'')+'>'
                +   '<div class="menu-item-bar">'
                +       '<div class="menu-item-handle sortable-handle-bar">'
                +           '<div class="item-title"></div>'
                +           '<div class="item-type"></div>'
                +           '<div class="btn-togglemenu"><i class="icon icon-down"></i></div>'
                +       '</div>' // .menu-item-handle
                +   '</div>' // .menu-item-bar
                +   '<div class="menu-item-body"></div>'
                +'</li>'
            );


            if ('function' == typeof this.options.templateMenu){

                html_inner_menu = this.options.templateMenu.call(this, data);
            }
            else{
                html_inner_menu = ''
                    +'<div class="form-group">'
                    +    '<label for="input-text-'+(data.id ? data.id : random_id)+'">Text</label>'
                    +    '<input type="text" id="input-text-'+(data.id ? data.id : random_id)+'" class="form-control" data-field="text"/>'
                    +'</div>'
                    +(function(always_show_url){
                        if (!always_show_url && data.type == 'category')
                            return '';

                        let snippet = ''
                            +'<div class="form-group">'
                            +   '<label for="input-url-'+(data.id ? data.id : random_id)+'">URL</label>'
                            +   '<input type="text" id="input-url-'+(data.id ? data.id : random_id)+'" class="form-control" data-field="url"/>'
                            +'</div>'
                        ;
                        return snippet;
                    })(this.options.always_show_url);
            }

            // Action button below
            html_inner_menu += ''
                +'<div class="form-check">'
                +    '<input class="form-check-input" type="checkbox" id="input-inputin-'+(data.id ? data.id : random_id)+'" value="1" data-field="new_tab"/>'
                +    '<label class="form-check-label" for="input-inputin-'+(data.id ? data.id : random_id)+'">Open in new tab</label>'
                +'</div>'
                +'<div class="form-group">'
                +    '<div class="menu-item-wrap-action action-mover">'
                +        '<span class="btn btn-xs item-action_label">Move</span>'
                +        '<a href="javascript:;" class="btn btn-xs btn-link" data-act="up">Up one</a>'
                +        '<a href="javascript:;" class="btn btn-xs btn-link" data-act="down">Down one</a>'
                +    '</div>'
                +    '<div class="menu-item-wrap-action action-child">'
                +        '<span class="btn btn-xs item-action_label">Sub</span>'
                +        '<a href="javascript:;" class="btn btn-xs btn-link d-none" data-act="child-out">Out from {{parent--item}}</a>'
                +        '<a href="javascript:;" class="btn btn-xs btn-link d-none" data-act="child-in">Under {{prev--item}}</a>'
                +    '</div>'
                +    '<div class="menu-item-wrap-action action-primary">'
                +        '<a href="javascript:;" class="btn btn-xs btn-link text-danger" data-act="remove">Remove</a>'
                +        '<a href="javascript:;" class="btn btn-xs btn-link" data-act="cancel">Cancel</a>'
                +    '</div>'
                +'</div>'
                +'';

            $item.find('.menu-item-body')
                .html($(html_inner_menu));


            $item.find('.item-type')
                .text(data.type)
                .data('type', data.type);

            $item.find('.item-title').text(data.text);
            $item.find('[data-field="text"]').attr('value', data.text);
            $item.find('[data-field="url"]').attr('value', data.url);

            if (data.new_tab)
                $item.find('[data-field="new_tab"]').prop('checked', !0);

            $item.data('menu', data);

            return $item;
        },

        /**
         * Prepare assign event to each menu in editor
         * Lookup element start from .btn-togglemenu under this.$el
         *
         * @return void
         */
        _menuEvents: function() {
            var instance = this;

            // Events:
            // - click togglemenu
            // - title change input label
            this.$el.find('.btn-togglemenu').each(function(){

                instance._menuEvent.call(instance, $(this).closest('.menu-item'));
            });

            // Events:
            // - click add inlinemenu
            this.$el.parent().find('.wrap-inline-action [data-act]').each(function(){
                var $btn = $(this);

                if ($btn.data('events'))
                    return true;

                $btn.on('click', function(e){
                    var $me = $(this),
                        act = $me.data('act');

                    if (act === 'add-menu'){
                        instance.add.call(instance, [{url:"", text:"Untitled", type: "link"}]);

                        // Open menu & focus to text
                        setTimeout(function(){
                            var $item = instance._lastMenuItem.call(instance);

                            $item.addClass('opened');

                            $item.find('[data-field="text"]')
                                .focus().select();
                        }, 0);
                    }
                }).data('events', true);
            });
        },

        /**
         * Assign event to given $menu_item
         * @param {DOM Element} $menu_item The DOM element of .menu-item
         *
         * Assigned event: 
         * - change input text
         * - click on mover buttons
         * - click on btn-togglemenu
         *
         * @return void
         */
        _menuEvent: function ($menu_item) {
            var instance = this;
            var sTO = null;

            // avoid multiple event assign
            if ($menu_item.data('events')){

                return !0;
            }

            // on change input text
            $menu_item.find('[data-field="text"]').on('keyup', function(){
                if (sTO)
                    clearTimeout(sTO);

                var $me = $(this);
                var value = $me.val();

                sTO = setTimeout(function(){
                    var $title = $me.closest('.menu-item').find('.item-title');

                    if (value)
                        $title.text(value);
                    else
                        $title.html('<em>Untitled</em>');
                }, 120);
            });

            // on click btn mover
            $menu_item.find('.menu-item-wrap-action [data-act]').each(function(){
                $(this).on('click', function(e){
                    var $me = $(this),
                        act = $me.data('act'),
                        $menu = $me.closest('.menu-item');

                    instance._moveMenu.call(instance, $menu, act);
                });
            });

            // on click btn-togglemenu
            $menu_item.find('.btn-togglemenu').on('click', function(){
                var $menu = $(this).closest('.menu-item');

                $menu.toggleClass('opened', !$menu.hasClass('opened'));
            });


            // at very last; avoid re assign event
            $menu_item.data('events', true);
        },

        /**
         * Move given $menu_item of specified direction
         * @param {DOM Element} $menu_item The DOM element of .menu-item
         * @param {String} action Action or direction to move element
         *
         * @return void
         */
        _moveMenu: function($menu_item, action) {
            var menu_index = $menu_item.index();
            var menu_count = $menu_item.parent().find('.menu-item').length;
            var menu_depth = parseInt($menu_item.css('--wpmenu_depth'));

            var $menu_target = null;
            var menu_target_index = null;

            if (!menu_depth || menu_depth < 0)
                menu_depth = 0;


            if (['up', 'down'].indexOf(action) !== -1){
                if (action == 'up')
                    menu_target_index = (menu_index - 1);
                else
                    menu_target_index = (menu_index + 1);

                if (menu_target_index < 0 || menu_target_index >= menu_count)
                    return !1;

                $menu_target = this.$el.find('.menu-item:eq('+menu_target_index+')');

                if (!$menu_target.length){
                    return !1;
                }
            }


            switch (action) {
                case "child-in":
                    menu_depth = (menu_depth + 1);

                    $menu_item
                        .attr('data-wpmenu_depth', menu_depth)
                        .css('--wpmenu_depth', menu_depth);
                break;

                case "child-out":
                    menu_depth = (menu_depth - 1);

                    if (!menu_depth){
                        $menu_item
                            .removeAttr('data-wpmenu_depth')
                            .css('--wpmenu_depth', '');

                    }
                    else{
                        $menu_item
                            .attr('data-wpmenu_depth', menu_depth)
                            .css('--wpmenu_depth', menu_depth);
                    }
                break;

                case "up":

                    $menu_item.insertBefore($menu_target);
                break;

                case "down":

                    $menu_item.insertAfter($menu_target);
                break;

                case "remove":

                    // $menu_item.insertAfter($menu_target);
                    $menu_item.remove();
                break;

                case "cancel":
                    if ($menu_item.hasClass('opened')){
                        $menu_item.find('.btn-togglemenu')
                            .trigger('click');
                    }
                break;
            };

            this._prepareRestructureMenu.call(this);

            this.$el.trigger('sortupdate');
        },

        /**
         * Prepare restructure all menu item
         *
         * @return void
         */
        _prepareRestructureMenu: function(){
            var instance = this;
            var menu_count = this.$el.find('.menu-item').length;

            this.$el.find('.menu-item').each(function(index, item){

                instance._restructureMenu.call(instance, index, $(item), menu_count);
            });
        },

        /**
         * Restructure given menu item.
         * This will correct accessibility to mover action button, etc.
         *
         * @param {Integer} index The index number menu item
         * @param {DOM Element} $menu_item The DOM element of .menu-item
         * @param {Integer} menu_count The count nambuer of .menu-item
         *
         * @return void
         */
        _restructureMenu: function(index, $menu_item, menu_count){
            // reset: hide all mover child & action
            $menu_item.find('.action-child, .action-child [data-act]')
                .addClass('d-none');

            var menu_depth = $menu_item.css('--wpmenu_depth');

            if (index == 0){
                $menu_item.find('[data-act="up"]')
                    .addClass('disabled')
                    .prop('disabled', !0);

                // As first index menu must have zero depth
                if (menu_depth) {
                    $menu_item.removeAttr('data-wpmenu_depth')
                        .css('--wpmenu_depth', '');
                }
            }
            else {
                // reset
                $menu_item.find('.action-child')
                    .removeClass('d-none');

                $menu_item.find('[data-act="up"], [data-act="down"]')
                    .removeClass('disabled')
                    .prop('disabled', !1);

                // last menu? disable move-down
                if (index == (menu_count - 1)){
                    $menu_item.find('[data-act="down"]')
                        .addClass('disabled')
                        .prop('disabled', !0);
                }


                // Check control visibility of menu item based on its depth
                var $prev_menu = $menu_item.prev(),
                    prev_menu_depth = $prev_menu.css('--wpmenu_depth'),
                    $under_element = null,
                    $parent = null;

                // menu item is a submenu of other
                if (menu_depth){
                    $parent = this._findParentMenuOf.call(this, $menu_item);

                    if ($parent && $parent.length){
                        $menu_item.find('[data-act="child-out"]')
                            .text('Out from '+$parent.find('.item-title').text())
                            .removeClass('d-none');
                    }

                    if (prev_menu_depth == menu_depth){
                        if (this.options.max_depth > menu_depth){
                            $menu_item.find('[data-act="child-in"]')
                                .text('Under '+$prev_menu.find('.item-title').text())
                                .removeClass('d-none');
                        }
                    }
                    else{
                        $menu_item.find('[data-act="child-in"]')
                            .addClass('d-none');
                    }
                }
                else{
                    // State of under element is a parent or a previous sibling
                    if (prev_menu_depth != menu_depth){
                        $under_element = this._findParentMenuOf.call(this, $prev_menu); 
                    }
                    else{
                        $under_element = $prev_menu;
                    }

                    if ($under_element && $under_element.length){
                        $menu_item.find('[data-act="child-in"]')
                            .text('Under '+$under_element.find('.item-title').text())
                            .removeClass('d-none');
                    }
                }
            }
        },

        /**
         * Add DOM Element generated menu item to editor
         * DOM Element is generated from _prepareMenu
         *
         * @param {DOM Element} $menu_item The DOM element of .menu-item
         * @param {Boolean} assign_event Whether to assign event per element appended. Default: true
         *
         * @return void
         */
        _addMenu: function($menu_item, assign_event) {
            if ('undefined' == typeof assign_event)
                assign_event = true;

            this.$el.append($menu_item);

            if (assign_event){
                // Assign events: toggle, etc
                this._menuEvent.call(this, $menu_item);
            }
        },

        /**
         * Collect data from rendered menus to json
         * Input element identified having attribute data-field
         *
         * return Array of data menus object
         */
        _collectDataMenus: function() {
            var instance = this;
            var data = [];
            var _data = [];
            var field_index = '__wpmenu_index_'+Utils.getRandomInt(1111, 99999999);
            var field_parent_index = '__wpmenu_parent_index_'+Utils.getRandomInt(1111, 99999999);

            // associate data to its index
            var data_indexed = {};

            var cleanupMenu = function(menus){
                var newdata = [];
                for(var i=0, iL=menus.length; i<iL; i++){
                    var item = menus[i];
                    var submenu = [];

                    if (item.submenu && item.submenu.length){
                        item.submenu = cleanupMenu(item.submenu);
                    }
                    else{
                        delete item.submenu;
                    }

                    delete item[field_index];

                    newdata.push(item);
                }

                return newdata;
            };

            this.$el.find('.menu-item').each(function(index, item){

                var $menu_item = $(this);
                var $menu_prev = $menu_item.prev();
                var menu_depth = parseInt($menu_item.css('--wpmenu_depth'));

                var item_data = $menu_item.data('menu') || {};
                var live_data = {};

                var $menu_parent = null;
                var parent_index = null;

                if (menu_depth){
                    $menu_parent = instance._findParentMenuOf.call(instance, $menu_item);
                    parent_index = $menu_parent.index();
                }

                $menu_item.find('[data-field]').each(function(){
                    var $input = $(this),
                        field = $input.data('field');

                    if (!field)
                        return true;

                    // skip unchecked checkbox input
                    if ($input.attr('type') == 'checkbox' && !$input.is(':checked'))
                        return true;

                    live_data[field] = $input.val();
                });
                item_data = $.extend({}, item_data, live_data);
                item_data[field_index] = index;
                item_data.submenu = [];

                if (parent_index !== null)
                    item_data[field_parent_index] = parent_index;

                _data.push(item_data);
            });

            // Sort data menu by index desc
            const sorter_desc = function(a, b){
                return b.index - a.index;
            };
            // Sort data menu by index asc
            const sorter_asc = function(a, b){
                return a.index - b.index;
            };


            for(var i=0, iL=_data.length; i<iL; i++){
                var item = JSON.parse(JSON.stringify(_data[i]));
                var index = _data[i][field_index];
                data_indexed[""+index] = item;
            }

            for(var i=_data.length-1, iL=0; i>=iL; i--){
                var item = JSON.parse(JSON.stringify(data_indexed[""+i]));

                var parent_index = (isNaN(item[field_parent_index]) ? null : item[field_parent_index]);
                var item_indexed = null;

                if (parent_index !== null){
                    delete item[field_parent_index];

                    // push item to its parent
                    item_indexed = data_indexed[""+parent_index];
                    item_indexed.submenu.push(item);

                    // sort by index
                    if (item_indexed.submenu.length){
                        item_indexed.submenu.sort(sorter_asc);
                    }
                    data_indexed[""+parent_index] = item_indexed;

                    delete data_indexed[i];
                }
            }

            data = cleanupMenu(Object.values(data_indexed));

            return data;
        },



        /**
         * Find parent menu of given menu item of $item based on its depth
         * @param Object $menu_item to start look
         *
         * return Object|null
         */
        _findParentMenuOf: function($menu_item) {
            var depth = $menu_item.css('--wpmenu_depth');
            var $menu_prev = $menu_item.prev();
            var prev_depth = $menu_prev.css('--wpmenu_depth');
            var found_it = false;
            var lost_it = false;
            var max_step = 100;
            var step = 1;

            if (!depth)
                return null;

            while(!found_it && !lost_it){
                // previous item no longer has specified class
                lost_it = !$menu_prev.hasClass('menu-item');

                if (!lost_it){
                    prev_depth = $menu_prev.css('--wpmenu_depth');
                    if (prev_depth != depth)
                        found_it = true;
                }
                step++;

                if (found_it || lost_it || (step >= max_step)){
                    break;
                }

                $menu_prev = $menu_prev.prev();
            }

            if (found_it)
                return $menu_prev;
            else
                return null;
        },

        /**
         * Get last DOM Element of menu item
         */
        _lastMenuItem: function(){

            return this.$el.find('.menu-item:last');
        },

        /**
         * Assign events of sidebar to add menu
         * - addmenu
         */
        _inserterEvents: function() {
            var instance = this;

            $(this.options.btn_addmenu_selector).each(function(){
                var $btn_addmenu = $(this),
                    $wrap = $btn_addmenu.closest('.wpmenu-accordion-item'),
                    menu_type = $wrap.data('type') || 'link',
                    $parent = $wrap.closest('.wpmenu-accordion');
                    $btn_toggler = $wrap.find('[data-toggle]'),

                // on click: btn_addmenu_selector
                $btn_addmenu.on('click', function(e){
                    var $me = $(this),
                        $wrap = $me.closest('.wpmenu-accordion-body'),
                        item_data = {type: menu_type},
                        data = []
                    ;

                    // case input having data-field: custom link
                    if ($wrap.find('[data-field]').length){
                        $wrap.find('[data-field]').each(function(){
                            var $input = $(this),
                                field = $input.data('field');

                            if (field)
                                item_data[field] = $input.val();
                        });

                        if (item_data.text)
                            data.push(item_data);
                    }else if($wrap.find('[data-url]').length && $wrap.find('[type="checkbox"]:checked').length){
                        $wrap.find('[type="checkbox"]:checked').each(function(){
                            var $input = $(this);

                            item_data = $.extend({}, item_data, $input.data());

                            data.push(item_data);
                        });
                    }

                    // using custom data collector?
                    if ('function' == typeof instance.options.addMenuDataCollector){

                        data = instance.options.addMenuDataCollector.call($wrap, data);
                    }

                    if (data.length)
                        instance.add.call(instance, data);
                });

                // on click: btn [data-toggle]
                $btn_toggler.on('click', function(){
                    var $me = $(this),
                        $target = $($me.data('target')),
                        slide_speed = 45,
                        $item = null,
                        $parent = null
                    ;

                    if (!$target.length)
                        return !0;

                    $item = $me.closest('.wpmenu-accordion-item');
                    $parent = $item.closest('.wpmenu-accordion');

                    $item.addClass('going-to');
                    $parent.find('.wpmenu-accordion-item.show:not(.going-to)')
                        .each(function(){
                            var $me = $(this);
                            var $body = $me.find('.wpmenu-accordion-body');
                            $me.removeClass('show');

                            if (!$body.is($target)){
                                $body.removeClass('show')
                                    .toggle(slide_speed);
                            }
                        });

                    $target.toggle(slide_speed, function(){
                        var $me = $(this),
                            isVisible = $me.is(":visible")

                        $me.toggleClass('show', isVisible);

                        $me.closest('.wpmenu-accordion-item')
                            .toggleClass('show', isVisible);
                    });

                    $item.toggleClass('going-to', !$target.is(":visible"));
                });
            });
        },

        /**
         * Ignite sortable to this.el
         */
        _sortable: function(){
            if ('function' !== typeof Sortable){
                console.error('Sortable is not defined');
                return !1;
            }
            var instance = this;

            // Has been run?
            if (this.sortable){
                this.$el.trigger('sortupdate');
                return !0;
            }

            var $element = this.$el,
                sortableOpts = {},
                stateAdjusted = null;

            sortableOpts = {
                handle: '.sortable-handle-bar',
                scrollSpeed: 10, // px
                animation: 80,

                // Element dragging ended
                onEnd: function (e) {

                    instance._prepareRestructureMenu.call(instance);
                    return !1;
                },

                // Event when you move an item in the list or between lists
                onMove: function (/**Event*/evt, /**Event*/originalEvent) {
                    // Example: http://jsbin.com/tuyafe/1/edit?js,output
                    // evt.dragged; // dragged HTMLElement
                    // evt.draggedRect; // TextRectangle {left, top, right и bottom}
                    // evt.related; // HTMLElement on which have guided
                    // evt.relatedRect; // TextRectangle
                    // originalEvent.clientY; // mouse position
                    // return false; — for cancel
                    // return stateAdjuster(evt.dragged);
                    return true;
                },
            };

            this.sortable = Sortable.create(this.el, sortableOpts);

            this._prepareRestructureMenu.call(this);
        },


        // keep it last
        _foo: 'noop'
    };
    // end: prototype



    /**
     * Register plugin withint jQuery plugins.
     *
     * @example
     * $('#element').wpMenuEditor();
     */
    $.fn[pluginName] = function(options) {
        var args = arguments;

        if (options === undefined || typeof options === 'object') {
            // Creates a new plugin instance, for each selected element, and
            // stores a reference withint the element's data
            return this.each(function() {
                if (!$.data(this, 'plugin_' + pluginName)) {
                    $.data(this, 'plugin_' + pluginName, new WPMenuEditor(this, options));
                }
            });
        } else if (typeof options === 'string' && options[0] !== '_' && options !== 'init') {
            // Call a public plugin method (not starting with an underscore) for each 
            // selected element.
            if (Array.prototype.slice.call(args, 1).length == 0 && $.inArray(options, $.fn[pluginName].getters) != -1) {
                // If the user does not pass any arguments and the method allows to
                // work as a getter then break the chainability so we can return a value
                // instead the element reference.
                var instance = $.data(this[0], 'plugin_' + pluginName);
                return instance[options].apply(instance, Array.prototype.slice.call(args, 1));
            } else {
                // Invoke the speficied method on each selected element
                return this.each(function() {
                    var instance = $.data(this, 'plugin_' + pluginName);
                    if (instance instanceof WPMenuEditor && typeof instance[options] === 'function') {
                        instance[options].apply(instance, Array.prototype.slice.call(args, 1));
                    }
                });
            }
        }
    };

    /**
     * Names of the plugin methods that can act as a getter method.
     * @type {Array}
     */
    $.fn[pluginName].getters = [
        'data',
    ];

    /**
     * Default options
     */
    $.fn[pluginName].defaults = defaults;

    // Expose the plugin class so it can be modified
    window.WPMenuEditor = Plugin;
}));
