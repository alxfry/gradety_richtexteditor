(function($) {
	$.widget("tf.gradety_rt", {
		_create: function() {
			var headerheight = 30;
			var sidebarwidth = 100;
			var buttonwidth = 60;
			var buttonmargin = 3;
			var borderwidth = 1;
			var width = this.element.width();
			var height = this.element.height();
			var contentheight = height - (2*borderwidth) - headerheight;
			var contentwidth = width - (2*borderwidth) - sidebarwidth;
			var that = this;
			var button_style = { 'width':''+buttonwidth+'px', 'margin':''+buttonmargin+'px' };
			
			//this.element.css({'border-style':'dashed','border-width':'1px','border-color':'#111111'});
			
			this.header = $("<div>").attr("id", "header")
									.css({'width':''+width+'px', 'height':''+headerheight+'px', 'position': 'absolute', 'top':'0px', 'left':'0px', 'background-color': '#FFFFFF'})
									.appendTo(this.element);
			this.content = $("<div>").attr("id", "content_field")
									.css({'border-style':'dashed','border-width':''+borderwidth+'px','border-color':'#111111', 'width':''+contentwidth+'px', 'height':''+contentheight+'px', 'position': 'absolute', 'top':''+headerheight+'px', 'left':'0px', 'background-color': '#EEEEFF'})
									.click(function() { if(that.options.edit_mode == false) that.startedit(); })
									.appendTo(this.element);
			this.sidebar = $("<div>").attr("id", "sidebar")
									.css({'width':''+sidebarwidth+'px', 'height':''+(height-headerheight)+'px', 'position': 'absolute', 'top':''+headerheight+'px', 'left':''+(contentwidth+2*borderwidth)+'px', 'background-color': '#FFFFFF'})
									.appendTo(this.element);
			this.accept_button = $("<input>").attr("id", "accept_changes_btn").attr("type", "button").attr("value", "Accept")
											.css(button_style).css({'background-color':'#11EE11', 'border-color':'#22EE22'})
											.appendTo(this.header)
											.click(function() { that.stopedit(); });
			this.cancel_button = $("<input>").attr("id", "cancel_changes_btn").attr("type", "button").attr("value", "Cancel")
											.css(button_style).css({'background-color':'#EE1111', 'border-color':'#EE2222'})
											.appendTo(this.header)
											.click(function() { that.stopedit(); });
			this.undo_button = $("<input>").attr("id", "undo_btn").attr("type", "button").attr("value", "Undo")
											.css(button_style).css({'background-color':'#EEEEEE'})
											.appendTo(this.header)
											.click(function() { that.undo(); });
			this.redo_button = $("<input>").attr("id", "redo_btn").attr("type", "button").attr("value", "Redo")
											.css(button_style).css({'background-color':'#EEEEEE'})
											.appendTo(this.header);
			this.link_button = $("<input>").attr("id", "link_btn").attr("type", "button").attr("value", "Link...")
											.css(button_style).css({'float':'top', 'background-color':'#EEEEEE'})
											.appendTo(this.sidebar)
											.click(function() {
												var url = that.options.window.prompt("URL:", "http://");
												if(url != null) {
													var contentAsHtml = that.content.html();
													if(that.options.rangy.getSelection().isCollapsed) {
														var anchor = that.options.window.prompt("Shown text:", url);
														if(anchor != null) {
															that.saveforundo();
															that.content.html(contentAsHtml + anchor.link(url));
														}
													}
													else {
														var linkStart = that.options.rangy.getSelection().anchorOffset;
														var linkEnd = that.options.rangy.getSelection().focusOffset;
														var part1 = contentAsHtml.substring(0, linkStart);
														var part2 = contentAsHtml.substring(linkStart, linkEnd);
														var part3 = contentAsHtml.substring(linkEnd, contentAsHtml.length);
														that.options.undo_first_change = false;
														that.saveforundo();
														that.content.html(part1 + part2.link(url) + part3);
													}
												}
											});
			this.format_button_1 = $("<input>").attr("id", "format_btn_1").attr("type", "button").attr("value", "Bold")
											.css(button_style).css({'float':'top', 'background-color':'#EEEEEE'})
											.appendTo(this.sidebar)
											.click(function() {
												that.options.undo_first_change = false;
												that.saveforundo();
												that.applyCSS('bold');
											});
			this.format_button_2 = $("<input>").attr("id", "format_btn_2").attr("type", "button").attr("value", "Red")
											.css(button_style).css({'float':'top', 'background-color':'#EEEEEE'})
											.appendTo(this.sidebar)
											.click(function() {
												that.options.undo_first_change = false;
												that.saveforundo();
												that.applyCSS('red');
											});
			this.format_button_3 = $("<input>").attr("id", "format_btn_3").attr("type", "button").attr("value", "Headline")
											.css(button_style).css({'float':'top', 'background-color':'#EEEEEE'})
											.appendTo(this.sidebar)
											.click(function() {
												that.options.undo_first_change = false;
												that.saveforundo();
												that.applyCSS('headline');
											});
			
			this.element.bind("gradety_rtstart_edit", function() {
												that.accept_button.fadeIn(1000);
												that.cancel_button.fadeIn(1000);
												that.link_button.fadeIn(1000);
												that.format_button_1.fadeIn(1000);
												that.format_button_2.fadeIn(1000);
												that.format_button_3.fadeIn(1000);
											});
			this.element.bind("gradety_rtstop_edit", function() {
												that.accept_button.fadeOut();
												that.cancel_button.fadeOut();
												that.undo_button.fadeOut();
												that.redo_button.fadeOut();
												that.link_button.fadeOut();
												that.format_button_1.fadeOut();
												that.format_button_2.fadeOut();
												that.format_button_3.fadeOut();
											});
			this.accept_button.hide();
			this.cancel_button.hide();
			this.undo_button.hide();
			this.redo_button.hide();
			this.link_button.hide();
			this.format_button_1.hide();
			this.format_button_2.hide();
			this.format_button_3.hide();
			
			this.content.keydown(function(event) {
						if(event.ctrlKey) {
							if(event.which == 90) {			//CTRL-Z
								event.preventDefault();
								that.undo();
							}
						}
						else {
							var keys = [
								8,		//Backspace
								13,		//Enter
								32,		//Space
								46		//Entf
							];
							if(keys.indexOf(event.which) != -1) {
								that.options.undo_first_change = false;
								that.saveforundo();
							}
							else if(that.options.undo_first_change) {
								that.saveforundo();
							}
						}
					});
		},
		startedit: function() {
			this.options.edit_mode = true;
			this.content.attr('contentEditable', 'true').css({'background-color' : '#FFFFFF'});
			this._trigger("start_edit");
			this.initundo();
		},
		stopedit: function() {
			this.options.edit_mode = false;
			this.content.attr('contentEditable', 'false').css({'background-color' : '#EEEEFF'});
			this._trigger("stop_edit");
		},
		initundo: function() {
			this.options.undo_stack = [this.content.html()];
			this.options.undo_index = 0;
			this.options.undo_first_change = true;
		},
		undo: function() {
			if(this.options.undo_index > 0) {
				this.options.undo_index--;
				this.content.html(this.options.undo_stack[this.options.undo_index]);
				if(this.options.undo_index == 0) {
					this.undo_button.fadeOut();
					this.options.undo_first_change = true;
				}
			}
		},
		saveforundo: function() {
			if(this.options.undo_stack[this.options.undo_index] != this.content.html()) {
				this.undo_button.fadeIn(1000);
				if(this.options.undo_first_change) {
					this.options.undo_index = 1;
					this.options.undo_stack[this.options.undo_index] = this.content.html();
				}
				else {
					while(this.options.undo_stack.length > this.options.undo_index) {
						this.options.undo_stack.pop();
					}
					this.options.undo_stack.push(this.content.html());
					this.options.undo_index++;
				}
			}
		},
		applyCSS: function(cssClass) {
			cssApplier = this.options.rangy.createCssClassApplier(cssClass);
			if(cssApplier.isAppliedToSelection()) {
				cssApplier.undoToSelection();
			}
			else {
				cssApplier.applyToSelection();
			}
		},
		setWindow: function(window) {
			this.options.window = window;
		},
		setRangy: function(rangy) {
			this.options.rangy = rangy;
		},
		options: {
			edit_mode: false,
			styles: [],
			undo_stack: [],
			undo_index: 0,
			undo_first_change: true,
			window: null,
			rangy: null
		}
	});
})(jQuery);