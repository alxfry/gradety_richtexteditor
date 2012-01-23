(function($) {
	$.widget("tf.gradety_rt", {
		_create: function() {
			var self = this;
			
			var unnestedElements = new Array(); //Blockelemente; dürfen nicht verschachtelt sein
			unnestedElements[0]="p";			// wird für applyCSS und paste gebraucht
			unnestedElements[1]="h1";
			unnestedElements[2]="h2";
			unnestedElements[3]="h3";
			unnestedElements[4]="h4";
			unnestedElements[5]="h5";
			unnestedElements[6]="h6";
			
			// Kopieren & Einfügen Optionen
			
			var allowedElements=new Array();	//Lowercase! Werden nicht gelöscht
			allowedElements[0]="div"; 			//div wird immer duch <br> ersetzt
			allowedElements[1]="p";
			allowedElements[3]="br";
			//allowedElements[5]="ol";
			//allowedElements[4]="li";
			//allowedElements[6]="ul";
			//allowedElements[4]="span";
			//allowedElements[6]="font";
			//allowedElements[7]="pre";
							 
			var defaultElements=new Array();	// ersetzt Elemente durch Standard-Elemente ohne Klassen/Attribute
			defaultElements[0] = "p";
							
			var delete_nbsp = true;	//alle &nbsp; werden gelöscht
			
			// Ende Kopieren & Einfügen Optionen							
			
			this.content = $('<div>').attr('id', 'content_field').appendTo(this.element);
			this.content.keydown(function(event) {
				if(event.ctrlKey) {
					if(event.which == 90) {					//CTRL-Z
						event.preventDefault();
						self.undo();
					}
					else if(event.which == 89) {			//CTRL-Y
						event.preventDefault();
						self.redo();
					}
				}
				else {
					var keys = [
						8,		//Backspace
						13,		//Enter
						32,		//Space
						46		//Entf
					];
					if($.inArray(event.which, keys) != -1) {
						self.options.undoFirstChange = false;
						self.updateUndoStack();
					}
					else if(self.options.undoFirstChange) {
						self.updateUndoStack();
					}
				}
			});
			this.content.bind("paste", function(e) {
				self.options.undoFirstChange = false;
				self.updateUndoStack();
				 
				self.content.find('*').each(function () {					//alle vor Paste vorhandenen Elemente bekommen Klasse "within"
					$(this).addClass("within");
				});
				
				setTimeout(function() {										//Timeout für Paste
					
					var content_desc = self.content.find(":not(.within)");
					
					$(content_desc).each(function() {						//für alle Nachkommen des containers
						var tag = $(this).prop("tagName").toLowerCase();	//HTML-Tag
						if(($.inArray(tag, allowedElements) == -1)) {		//falls Element nicht in allowedElements
							if($(this).find(":first-child").length != 0) {	//falls child existiert
								$(this).find(">:first-child").unwrap(); 	//entferne Element
							}
							else if($(this).not(":empty")) {				//falls kein child und nicht leer (Text)
								var innerContent = this.innerText || this.textContent;
								$(this).replaceWith(this.html);				//entferne Element, lasse Text stehen;
							}
							else {											//leer und kein child -> remove
								$(this).remove();
							}															
						}													
					});
					content_desc = self.content.find(":not(.within)");
					$(content_desc).each(function() {						//Default Elements und <div> ersetzen
						var tag = $(this).prop("tagName").toLowerCase();
						if($.inArray(tag, defaultElements) != -1) {
							$(this).replaceWith("<" + tag + ">" + this.innerHTML + "</" + tag + ">");
						}													
						else if(tag == "div") {
							$(this).replaceWith(this.innerHTML + "</br>");	//ersetze <DIV></DIV> mit </BR>
						}
					});
					
					if(delete_nbsp) { 										// &nbsp; löschen
						content_desc = $("#content_field").find(":not(.within)");
						$(content_desc).each(function() {							
							this.innerHTML = this.innerHTML.replace(/&nbsp;/gi, " ");
						}); 												//klappt nicht bei &nbsp; ohne container (zB <br> in Firefox)												
					}
					
					//Überprüfen der Verschachtelung
					var contentDescNotChildren = self.content.find(":not(.within)").not(self.content.children());
					contentDescNotChildren.each(function() {
						var tempTag = $(this).prop("tagName").toLowerCase();
						if($.inArray(tempTag, unnestedElements) != -1 ) {
							var innerContent = this.innerText || this.textContent;
							$(this).unwrap();	
						}														
					});
						
				}, 0);
				
				setTimeout(function() {
					self.content.find('*').each(function () { 				//alte "within" Klasse wird entfernt
						$(this).removeClass("within");
						if($(this).hasClass("")) {
							$(this).removeAttr("class");
						}
					});
				}, 0);												
			});
			
			this._trigger('onCreate', null, this);
		},
		startEditing: function() {
			if(this.options.editMode == false) {
				this.options.editMode = true;
				this.content.attr('contentEditable', 'true');
				this._initUndoManagement();
				this._trigger('onStartEditing', null, this);
				this._trigger('onUndoDisabled', null, this);
				this._trigger('onRedoDisabled', null, this);
			}
		},
		stopEditing: function(acceptChanges) {
			if(this.options.editMode) {
				this.options.editMode = false;
				this.content.attr('contentEditable', 'false');
				if(acceptChanges == false) {
					while(this.options.undoIndex > 0) {
						this.undo();
					}
				}
				this._trigger('onStopEditing', null, this);
			}
		},
		_initUndoManagement: function() {
			this.options.undoStack = [this.content.html()];
			this.options.undoIndex = 0;
			this.options.undoFirstChange = true;
		},
		updateUndoStack: function() {
			//if(this.options.undo_stack[this.options.undo_index] != this.content.html()) {
			if(this.options.undoFirstChange) {
				this.options.undoIndex = 1;
				this.options.undoStack[this.options.undoIndex] = this.content.html();
			}
			else {
				while(this.options.undoStack.length > this.options.undoIndex) {
					this.options.undoStack.pop();
				}
				this.options.undoStack.push(this.content.html());
				this.options.undoIndex++;
			}
			this._trigger('onUndoStackUpdate', null, this);
			//}
		},
		undo: function() {
			if(this.options.undoIndex > 0) {
				if(this.options.undoIndex == this.options.undoStack.length) {
					this.options.undoStack.push(this.content.html());
				}
				this.options.undoIndex--;
				this.content.html(this.options.undoStack[this.options.undoIndex]);
				this._trigger('onUndone', null, this);
				if(this.options.undoIndex == 0) {
					this.options.undoFirstChange = true;
					this._trigger('onUndoDisabled', null, this);
				}
			}
		},
		redo: function() {
			this.options.undoIndex++;
			this.content.html(this.options.undoStack[this.options.undoIndex]);
			this._trigger('onRedone', null, this);
			if(this.options.undoIndex == this.options.undoStack.length - 1) {
				this.options.undoStack.pop();
				this._trigger('onRedoDisabled', null, this);
			}
		},
		defineLink: function() {
			var withNewText = this.options.rangy.getSelection().isCollapsed;
			this._trigger('onDefineLink', null, { self: this, withNewText : withNewText });
		},
		addLinkWithNewText: function(url, title, text) {
			this.options.undoFirstChange = false;
			this.updateUndoStack();
			this.content.html(this.content.html() + ("<a href=" + url + " title=\"" + title + "\" class=\"link\" >" + text + "</a>"));
		},
		addLink: function(url, title) {
			this.options.undoFirstChange = false;
			this.updateUndoStack();
			this.options.rangy.createCssClassApplier("link", {
					elementTagName: "a",
					elementProperties: {
						href: url,
						title: title
					}
				}).toggleSelection();
		},
		formatWithCSS: function(cssClass) {
			this.options.undoFirstChange = false;
			this.updateUndoStack();
			cssApplier = this.options.rangy.createCssClassApplier(cssClass);
			if(cssApplier.isAppliedToSelection()) {
				cssApplier.undoToSelection();
			}
			else {
				cssApplier.applyToSelection();
				
				var contentDescNotChildren = this.content.find("*").not(this.content.children());
				contentDescNotChildren.each(function() {
					var unnestedElements = new Array();		//Blockelemente; dürfen nicht verschachtelt sein
					unnestedElements[0]="p";
					unnestedElements[1]="h1";
					unnestedElements[2]="h2";
					unnestedElements[3]="h3";
					unnestedElements[4]="h4";
					unnestedElements[5]="h5";
					unnestedElements[6]="h6";
					var tempTag = $(this).prop("tagName").toLowerCase();
					if($.inArray(tempTag, unnestedElements) != -1 ) {
						cssApplier.undoToSelection();
					}
				});
			}
		},
		clean: function() {
			this.options.undoFirstChange = false;
			this.updateUndoStack();
			this.content.html(this.content.text());
		},
		options: {
			editMode: false,
			styles: [],
			undoStack: [],
			undoIndex: 0,
			undoFirstChange: true,
			window: null,
			rangy: null,
			
			//########## CALLBACKS -> werden vom Anwender überschrieben:
			
			//wird bei Erzeugen des Widgets aufgerufen
			onCreate: function(event, self) {
				var headerHeight = 30;
				var sidebarWidth = 100;
				var buttonWidth = 60;
				var buttonMargin = 3;
				var borderWidth = 1;
				var width = self.element.width();
				var height = self.element.height();
				var contentHeight = height - (2*borderWidth) - headerHeight;
				var contentWidth = width - (2*borderWidth) - sidebarWidth;
				var buttonStyle = { 'width':''+buttonWidth+'px', 'margin':''+buttonMargin+'px' };
				self.header = $("<div>").attr("id", "header")
						.css({'width':''+width+'px', 'height':''+headerHeight+'px', 'position': 'absolute', 'top':'0px', 'left':'0px', 'background-color': '#FFFFFF'})
						.appendTo(self.element);
				self.content.css({'border-style':'dashed','border-width':''+borderWidth+'px','border-color':'#111111', 'width':''+contentWidth+'px', 'height':''+contentHeight+'px', 'position': 'absolute', 'top':''+headerHeight+'px', 'left':'0px', 'background-color': '#EEEEFF'})
						.click(function() {
							self.startEditing();
						});
				self.sidebar = $("<div>").attr("id", "sidebar")
						.css({'width':''+sidebarWidth+'px', 'height':''+(height-headerHeight)+'px', 'position': 'absolute', 'top':''+headerHeight+'px', 'left':''+(contentWidth+2*borderWidth)+'px', 'background-color': '#FFFFFF'})
						.appendTo(self.element);
				self.acceptButton = $("<input>").attr("id", "accept_changes_btn").attr("type", "button").attr("value", "Accept")
						.css(buttonStyle).css({'background-color':'#11EE11', 'border-color':'#22EE22'})
						.appendTo(self.header)
						.click(function() {
							self.stopEditing(true);
						});
				self.cancelButton = $("<input>").attr("id", "cancel_changes_btn").attr("type", "button").attr("value", "Cancel")
						.css(buttonStyle).css({'background-color':'#EE1111', 'border-color':'#EE2222'})
						.appendTo(self.header)
						.click(function() {
							self.stopEditing(false);
						});
				self.undoButton = $("<input>").attr("id", "undo_btn").attr("type", "button").attr("value", "Undo")
						.css(buttonStyle).css({'background-color':'#EEEEEE'})
						.appendTo(self.header)
						.click(function() {
							self.undo();
						});
				self.redoButton = $("<input>").attr("id", "redo_btn").attr("type", "button").attr("value", "Redo")
						.css(buttonStyle).css({'background-color':'#EEEEEE'})
						.appendTo(self.header)
						.click(function() {
							self.redo();
						});
				self.linkButton = $("<input>").attr("id", "link_btn").attr("type", "button").attr("value", "Link...")
						.css(buttonStyle).css({'float':'top', 'background-color':'#EEEEEE'})
						.appendTo(self.sidebar)
						.click(function() {
							self.defineLink();
						});
				self.cleanButton = $("<input>").attr("id", "clean_btn").attr("type", "button").attr("value", "Clean Up") //Alle HTML-Formatierungen löschen
						.css(buttonStyle).css({'float':'top', 'background-color':'#EEEEEE'})
						.appendTo(self.sidebar)
						.click(function() {
							self.clean();
						});
				self.formatButton1 = $("<input>").attr("id", "format_btn_1").attr("type", "button").attr("value", "Bold")
						.css(buttonStyle).css({'float':'top', 'background-color':'#EEEEEE'})
						.appendTo(self.sidebar)
						.click(function() {
							self.formatWithCSS('bold');
						});
				self.formatButton2 = $("<input>").attr("id", "format_btn_2").attr("type", "button").attr("value", "Red")
						.css(buttonStyle).css({'float':'top', 'background-color':'#EEEEEE'})
						.appendTo(self.sidebar)
						.click(function() {
							self.formatWithCSS('red');
						});
				self.formatButton3 = $("<input>").attr("id", "format_btn_3").attr("type", "button").attr("value", "Headline")
						.css(buttonStyle).css({'float':'top', 'background-color':'#EEEEEE'})
						.appendTo(self.sidebar)
						.click(function() {
							self.formatWithCSS('headline');
						});
				self.acceptButton.hide();
				self.cancelButton.hide();
				self.undoButton.hide();
				self.redoButton.hide();
				self.linkButton.hide();
				self.cleanButton.hide();
				self.formatButton1.hide();
				self.formatButton2.hide();
				self.formatButton3.hide();
			},
			//wird bei Starten des Editiervorgangs aufgerufen
			onStartEditing: function(event, self) {
				self.acceptButton.fadeIn(1000);
				self.cancelButton.fadeIn(1000);
				self.linkButton.fadeIn(1000);
				self.cleanButton.fadeIn(1000);
				self.undoButton.fadeIn(1000);
				self.redoButton.fadeIn(1000);
				self.formatButton1.fadeIn(1000);
				self.formatButton2.fadeIn(1000);
				self.formatButton3.fadeIn(1000);
				self.content.css({'background-color' : '#FFFFFF'});
			},
			//wird bei Beenden des Editiervorgangs aufgerufen
			onStopEditing: function(event, self) {
				self.acceptButton.fadeOut();
				self.cancelButton.fadeOut();
				self.undoButton.fadeOut();
				self.redoButton.fadeOut();
				self.linkButton.fadeOut();
				self.cleanButton.fadeOut();
				self.formatButton1.fadeOut();
				self.formatButton2.fadeOut();
				self.formatButton3.fadeOut();
				self.content.css({'background-color' : '#EEEEFF'});
			},
			//wird nach einer Undo-Operation aufgerufen
			onUndone: function(event, self) {
				self.redoButton.removeAttr('disabled');
			},
			//wird nach der letztmöglichen Undo-Operation aufgerufen
			onUndoDisabled: function(event, self) {
				self.undoButton.attr('disabled', 'true');
			},
			//wird nach einer Redo-Operation aufgerufen
			onRedone: function(event, self) {
				self.undoButton.removeAttr('disabled');
			},
			//wird nach der letztmöglichen Redo-Operation aufgerufen
			onRedoDisabled: function(event, self) {
				self.redoButton.attr('disabled', 'true');
			},
			//wird bei Änderung des Textes (und somit Änderung des Undo-Stacks) aufgerufen
			onUndoStackUpdate: function(event, self) {
				self.undoButton.removeAttr('disabled');
				self.redoButton.attr('disabled', 'true');
			},
			//wird aufgerufen, sobald ein Link eingefügt werden möchte
			onDefineLink: function(event, data) {
				var self = data.self;
				var withNewText = data.withNewText;
				
				var url = self.options.window.prompt("URL:", "http://");
				if(url != null) {
					var title = self.options.window.prompt("Title (shown while hovering):", url);
					if(withNewText) {
						var text = self.options.window.prompt("Shown text:", title);
						if(text != null) {
							self.addLinkWithNewText(url, title, text);
						}
					}
					else {
						self.addLink(url, title);
					}
				}
			}
		}
	});
})(jQuery);