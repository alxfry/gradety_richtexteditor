jQuery.fn.extend({ 
	disableSelection : function() { 
		return this.each(function() {
			this.onselectstart = function() { return false; }; 
			this.unselectable = "on"; 
			jQuery(this).css('user-select', 'none'); 
			jQuery(this).css('-o-user-select', 'none'); 
			jQuery(this).css('-moz-user-select', 'none'); 
			jQuery(this).css('-khtml-user-select', 'none'); 
			jQuery(this).css('-webkit-user-select', 'none'); 
		}); 
	}
}); 
(function($) {
	$.widget('tf.gradety_rt', {
		_create: function() {
			var self = this;
			var o = this.options;
			
			//Textfeld erzeugen
			this.content = $('<div>').attr('id', 'content_field').appendTo(this.element);
			
			//Textfeld mit Beispieltext f�llen
			this.content.html('<p>Beispieltext. Blabla 1 Blabla 2</p><h2>Zwischen�berschrift</h2><p>Noch mehr Beispieltext. <strong>Fetter Text.</strong> Und noch mehr.</p>');
			
			//Key-Events
			this.content.keydown(function(event) {
				if(event.ctrlKey) {
					if(event.which == 90) {					//STRG-Z -> Undo
						event.preventDefault();
						self.undo();
					}
					else if(event.which == 89) {			//STRG-Y -> Redo
						event.preventDefault();
						self.redo();
					}
					else if(event.which == 86) {			//STRG-V -> Paste
						self.content.trigger('paste');
					}
					else if(event.which != 65 && event.which != 67 && event.which != 88) {			//STRG-A, STRG-C, STRG-V, STRG-X -> einzige Shortcuts mit Standardbelegung
						event.preventDefault();
					}
				}
				else {
					var keys = [
						8,			//Backspace
						13,			//Enter
						32,			//Space
						46			//Entf
					];
					//Arbeitsschritt speichern, bevor einer der obigen Keys eingegeben wird
					if($.inArray(event.which, keys) != -1) {
						self.updateUndoStack(false);
					}
					else if(self.undoSystem.firstChange && event.which != 16 && event.which != 20) {
						self.updateUndoStack(true);
					}
					self._checkOnEmptiness();
				}
			});
			
			//Paste-Event
			this.content.bind('paste', function(event) {
				if(self.pasteLock) {
					return;
				}
				
				self.pasteLock = true;
				
				//Arbeitsschritt speichern
				self.updateUndoStack(false);
				
				setTimeout(function() {
					//ung�ltige Formatierungen entfernen
					self._removeInvalidFormatting();
					self.pasteLock = false;
				}, 0);
			});
			
			//Cut-Event
			this.content.bind('cut', function(event) {
				//Arbeitsschritt speichern
				self.updateUndoStack(false);
				self._checkOnEmptiness();
			});
			
			//Datenobjekt f�r Callback-Funktionen
			this.data = {
				element: self.element,
				content: self.content,
				ui: {},
				logic: {
					startEditing: function() { self.startEditing() },
					stopEditing: function(acceptChanges) { self.stopEditing(acceptChanges) },
					updateUndoStack: function(firstChange) { self.updateUndoStack(firstChange) },
					undo: function() { self.undo() },
					redo: function() { self.redo() },
					defineLink: function() { self.defineLink() },
					insertLink: function(url, title, css) { self.insertLink(url, title, css) },
					format: function(tag, css) { self.format(tag, css) },
					clearFormat: function() { self.clearFormat() },
					clearAll: function() { self.clearAll() }
				}
			};
			
			this._trigger('onCreate', null, [this.data, this.options]);
		},
		//Editiervorgang initialisieren
		startEditing: function() {
			if(this.editMode == false) {
				this.editMode = true;
				this.content.attr('contentEditable', 'true');
				this._initUndoManagement();
				this._trigger('onStartEditing', null, this.data);
				this._trigger('onUndoDisabled', null, this.data);
				this._trigger('onRedoDisabled', null, this.data);
			}
		},
		//Editiervorgang abschlie�en (mit oder ohne Speicherung)
		stopEditing: function(acceptChanges) {
			if(this.editMode) {
				this.editMode = false;
				this.content.attr('contentEditable', 'false');
				if(acceptChanges == false) {
					while(this.undoSystem.index > 0 && this.undoSystem.stack[this.undoSystem.index - 1] != null) {
						this.undo();
					}
				}
				this._trigger('onStopEditing', null, this.data);
			}
		},
		//leeres Textfeld mit Paragraph initialisieren
		_checkOnEmptiness: function() {
			var self = this;
			setTimeout(function() {
				self.content.contents().each(function() {
					var n = $(this);
					if(this.nodeType == 3 || $.inArray(this.tagName.toLowerCase(), self.options.blockHtmlElements) == -1) {
						n.wrap('<p/>');
						var range = rangy.createRange();
						range.setStart(this, this.data ? this.data.length : 0);
						range.setEnd(this, this.data ? this.data.length : 0);
						rangy.getSelection().setSingleRange(range);
					}
				});
			}, 0);
		},
		//Undo-Redo-System initialisieren
		_initUndoManagement: function() {
			this.undoSystem.stack = [this.content.html()];
			this.undoSystem.index = 0;
			this.undoSystem.firstChange = true;
			this.undoSystem.indexOfFirstChange = 0;
		},
		//Arbeitsschritt (aktueller Textfeld-Inhalt) speichern
		updateUndoStack: function(firstChange) {
			var u = this.undoSystem;
			if(firstChange == false) {
				u.firstChange = false;
			}
			if(u.firstChange) {
				u.index = u.indexOfFirstChange + 1;
				u.stack[u.index] = this.content.html();
				while(u.stack.length > u.index) {
					u.stack.pop();
				}
			}
			else {
				while(u.stack.length > u.index) {
					u.stack.pop();
				}
				u.stack.push(this.content.html());
				u.index++;
				if(u.index > this.options.undoStackSize) {
					u.stack[u.index - this.options.undoStackSize] = null;
				}
			}
			this._trigger('onRedoDisabled', null, this.data);
			this._trigger('onUndoStackUpdate', null, this.data);
		},
		//Arbeitsschritt r�ckg�ngig machen
		undo: function() {
			var u = this.undoSystem;
			if(u.index > 0) {
				if(u.index == u.stack.length) {
					u.stack.push(this.content.html());
				}
				u.index--;
				this.content.html(u.stack[u.index]);
				this._trigger('onUndone', null, this.data);
				if(u.index == 0 || u.stack[u.index - 1] == null) {
					u.firstChange = true;
					u.indexOfFirstChange = u.index;
					this._trigger('onUndoDisabled', null, this.data);
				}
			}
		},
		//Arbeitsschritt wiederholen
		redo: function() {
			var u = this.undoSystem;
			u.index++;
			this.content.html(u.stack[u.index]);
			this._trigger('onRedone', null, this.data);
			if(u.index == u.stack.length - 1) {
				u.stack.pop();
				this._trigger('onRedoDisabled', null, this.data);
			}
		},
		//Linkeingabe starten
		defineLink: function() {
			this._trigger('onDefineLink', null, this.data);
		},
		//Auswahl formatieren
		formatRaw: function(tag, attrs) {
			var self = this;
			var o = this.options;
			
			//neue Formatierung einsetzen oder lediglich "aufr�umen"
			var newFormatting = false;
			if(tag) {
				newFormatting = true;
			}
			
			var anchorNode, anchorOffset, focusNode, focusOffset;
			var inline, median, medianInP;
			var node1, node2, offset1, offset2;
			
			var htmlContent = '';
			var nodeTagStack = new Array(), nodeAttrsStack = new Array();
			var handled1 = false, handled2 = false;
			
			if(newFormatting) {
				
				//Daten aus aktueller Auswahl beziehen
				var sel = rangy.getSelection();
				if(sel.isCollapsed) {
					this.content.focus();
					sel = rangy.getSelection();
				}
				anchorNode = sel.anchorNode;
				anchorOffset = sel.anchorOffset;
				focusNode = sel.focusNode;
				focusOffset = sel.focusOffset;
				
				//Inline- oder Blockformatierung?
				inline = ($.inArray(tag, o.inlineHtmlElements) != -1);
				
				median = tag == 'clear';
				medianInP = false;
				
				//Richtung der Auswahl (vorw�rts/r�ckw�rts) bestimmen und standardisieren
				var foundAnchor = false, foundFocus = false;
				this._traverseDOMTree(document.getElementById('content_field'), -1, function(node, level) {
					if(foundAnchor == false) {
						if(node == anchorNode) {
							if(foundFocus == false) {
								node1 = anchorNode;
								node2 = focusNode;
								offset1 = anchorOffset;
								offset2 = focusOffset;
							}
							foundAnchor = true;
						}
					}
					if(foundFocus == false) {
						if(node == focusNode) {
							if(foundAnchor == false) {
								node1 = focusNode;
								node2 = anchorNode;
								offset1 = focusOffset;
								offset2 = anchorOffset;
							}
							foundFocus = true;
						}
					}
				}, null);
				if(anchorNode == focusNode) {
					if(anchorOffset == focusOffset && tag != 'insert') {
						offset1 = 0;
						offset2 = anchorNode.data.length;
					}
					else if(anchorOffset < focusOffset) {
						offset1 = anchorOffset;
						offset2 = focusOffset;
					}
					else {
						offset1 = focusOffset;
						offset2 = anchorOffset;
					}
				}
				
				//liegt die Auswahl au�erhalb des Textfeldes, Formatieren abbrechen!
				if(foundAnchor == false || foundFocus == false) {
					return;
				}
				
				//Arbeitsschritt speichern
				this.updateUndoStack(false);
				
				//Auswahl auf Textknoten reduzieren
				if(node1.nodeType == 1) {
					while(node1.nodeType == 1) {
						if(node1.firstChild == null) {
							$(node1.parentNode).prepend(' ');
							node1 = node1.parentNode.firstChild;
						}
						else {
							node1 = node1.firstChild;
						}
					}
					offset1 = 0;
				}
				if(node2.nodeType == 1) {
					while(node2.nodeType == 1) {
						if(node2.lastChild == null) {
							$(node2.parentNode).append(' ');
							node2 = node2.parentNode.lastChild;
						}
						else {
							node2 = node2.lastChild;
						}
					}
					offset2 = node2.data.length;
				}
				
				//f�r "Median"-Elemente (clear) �berpr�fen, ob die Auswahl in einem Paragraphen startet und endet
				if(median) {
					var p1 = false;
					$(node1).parentsUntil(this.content).each(function() {
						if(this.tagName.toLowerCase() == 'p') {
							p1 = true;
						}
					});
					if(p1) {
						$(node2).parentsUntil(this.content).each(function() {
							if(this.tagName.toLowerCase() == 'p') {
								medianInP = true;
							}
						});
					}
				}
			
			}
			else {
				//paragraphenlosen Inhalt wrappen
				if(document.getElementById('content_field').firstChild.nodeType == 3) {
					this.content.html('<p>' + this.content.html() + '</p>');
				}
			}
			
			//alle Elemente durchlaufen
			this._traverseDOMTree(document.getElementById('content_field'), -1, function(node, level) {
				
				if(level == -1) {
					return;
				}
				
				//aktueller Knoten = Elementknoten -> Eigenschaften auslesen und in Stack speichern
				var jQNode = $(node), nodeTag, nodeAttrs;
				if(node.nodeType == 1) {
					nodeTag = node.tagName.toLowerCase();
					
					if(nodeTag) {
						if(nodeTag == 'br') {
							htmlContent += '<br>';
						}
						else if($.inArray(nodeTag, o.blockHtmlElements) == -1 && level == 0) {
							nodeTag = 'p';
						}
						else if(($.inArray(nodeTag, o.blockHtmlElements) == -1 || level > 0) && $.inArray(nodeTag, o.inlineHtmlElements) == -1) {
							nodeTag = '';
						}
					}
					else {
						nodeTag = '';
					}
					
					nodeAttrs = '';
					if(nodeTag != '' && nodeTag != 'p') {
						for(var i = 0; i < o.validAttrs.length; i++) {
							var a = o.validAttrs[i];
							if(jQNode.attr(a)) {
								nodeAttrs += ' ' + a + '=\"' + jQNode.attr(a) + '\"';
							}
						}
					}
					if(nodeTagStack.length <= level) {
						nodeTagStack.push(nodeTag);
						nodeAttrsStack.push(nodeAttrs);
					}
					else {
						nodeTagStack[level] = nodeTag;
						nodeAttrsStack[level] = nodeAttrs;
					};
				}
				
				//oberste Ebene (Blockelemente)
				if(level == 0) {
					if(node.nodeType == 1) {
						if(!newFormatting || inline || !handled1 || handled2) {
							htmlContent += '<' + nodeTag + nodeAttrs + '>';
							if(node.firstChild == null) {
								htmlContent += '&nbsp;';
							}
						}
					}
				}
				//tiefere Ebene (Median- und Inlineelemente)
				else {
					//Elementknoten
					if(node.nodeType == 1 && nodeTag != 'br') {
						htmlContent += '<' + nodeTag + nodeAttrs + '>';
						if(node.firstChild == null) {
							htmlContent += '&nbsp;';
						}
					}
					//Textknoten
					else if(node.nodeType == 3) {
						if(!newFormatting) {
							htmlContent += Encoder.htmlEncode(node.data, true);
						}
						else {
							//Auswahl liegt komplett im Knoten...
							if(node == node1 && node == node2) {
								if(inline) {
									htmlContent += Encoder.htmlEncode(node.data.substring(0, offset1), true) + '<' + tag + attrs + '>'
											+ Encoder.htmlEncode(node.data.substring(offset1, offset2), true) + '</' + tag + '>'
											+ Encoder.htmlEncode(node.data.substring(offset2, node.data.length), true);
								}
								else {
									htmlContent += Encoder.htmlEncode(node.data.substring(0, offset1), true);
									for(var i = level - 1; i >= medianInP ? 1 : 0; i--) {
										htmlContent += '</' + nodeTagStack[i] + '>';
									}
									htmlContent += '<' + tag + attrs + '>';
									for(var i = 1; i < level; i++) {
										htmlContent += '<' + nodeTagStack[i] + nodeAttrsStack[i] + '>';
									}
									htmlContent += Encoder.htmlEncode(node.data.substring(offset1, offset2), true);
									for(var i = level - 1; i >= 1; i--) {
										htmlContent += '</' + nodeTagStack[i] + '>';
									}
									htmlContent += '</' + tag + '>';
									for(var i = medianInP ? 1 : 0; i < level; i++) {
										htmlContent += '<' + nodeTagStack[i] + nodeAttrsStack[i] + '>';
									}
									htmlContent += Encoder.htmlEncode(node.data.substring(offset2, node.data.length), true);
								}
								handled1 = handled2 = true;
							}
							//Auswahl beginnt im Knoten...
							else if(node == node1) {
								if(inline) {
									htmlContent += Encoder.htmlEncode(node.data.substring(0, offset1), true) + '<' + tag + attrs + '>'
											+ Encoder.htmlEncode(node.data.substring(offset1, node.data.length), true) + '</' + tag + '>';
								}
								else {
									htmlContent += Encoder.htmlEncode(node.data.substring(0, offset1), true);
									for(var i = level - 1; i >= medianInP ? 1 : 0; i--) {
										htmlContent += '</' + nodeTagStack[i] + '>';
									}
									htmlContent += '<' + tag + attrs + '>';
									for(var i = 1; i < level; i++) {
										htmlContent += '<' + nodeTagStack[i] + nodeAttrsStack[i] + '>';
									}
									htmlContent += Encoder.htmlEncode(node.data.substring(offset1, node.data.length), true);
								}
								handled1 = true;
							}
							//Auswahl endet im Knoten...
							else if(node == node2) {
								if(inline) {
									htmlContent += '<' + tag + attrs + '>' + Encoder.htmlEncode(node.data.substring(0, offset2), true)
											+ '</' + tag + '>' + Encoder.htmlEncode(node.data.substring(offset2, node.data.length), true);
								}
								else {
									htmlContent += Encoder.htmlEncode(node.data.substring(0, offset2), true);
									for(var i = level - 1; i >= 1; i--) {
										htmlContent += '</' + nodeTagStack[i] + '>';
									}
									htmlContent += '</' + tag + '>';
									for(var i = medianInP ? 1 : 0; i < level; i++) {
										htmlContent += '<' + nodeTagStack[i] + nodeAttrsStack[i] + '>';
									}
									htmlContent += Encoder.htmlEncode(node.data.substring(offset2, node.data.length), true);
								}
								handled2 = true;
							}
							//Auswahl erstreckt sich komplett �ber Knoten...
							else if(handled1 && !handled2) {
								if(inline) {
									htmlContent += '<' + tag + attrs + '>' + Encoder.htmlEncode(node.data, true) + '</' + tag + '>';
								}
								else {
									htmlContent += Encoder.htmlEncode(node.data, true);
								}
							}
							//Auswahl ber�hrt Knoten nicht
							else {
								htmlContent += Encoder.htmlEncode(node.data, true);
							}
						}
					}
				}
				
			}, function(node, level) {
				
				if(level == -1) {
					return;
				}
				
				if(node.nodeType == 1) {
					var nodeTag = node.tagName.toLowerCase();
					
					if(nodeTag) {
						if($.inArray(nodeTag, o.blockHtmlElements) == -1 && level == 0) {
							nodeTag = 'p';
						}
						else if(($.inArray(nodeTag, o.blockHtmlElements) == -1 || level > 0) && $.inArray(nodeTag, o.inlineHtmlElements) == -1) {
							nodeTag = '';
						}
					}
					else {
						nodeTag = '';
					}
					if(nodeTag != 'br') {
						if(level == 0) {
							if(!newFormatting || inline || !handled1 || handled2) {
								htmlContent += '</' + nodeTag + '>';
							}
						}
						else {
							htmlContent += '</' + nodeTag + '>';
						}
					}
					
				}
				
			});
			
			//alert(htmlContent);
			
			//leere Tags entfernen
			htmlContent = htmlContent.replace(/<\/?>/g, '');
			
			//zu l�schende Formatierungen entfernen
			var stringToClear, index;
			if((index = htmlContent.search(/<clear>/)) != -1) {
				stringToClear = htmlContent.substring(index + '<clear>'.length, htmlContent.search(/<\/clear>/));
				stringToClear = stringToClear.replace(/<(?!br)\/?[^>]*>/g, '');
				htmlContent = htmlContent.replace(/<clear>.*<\/clear>/, '');
				htmlContent = htmlContent.substring(0, index) + stringToClear + htmlContent.substring(index, htmlContent.length);
			}
			
			//<br>s wrappen
			htmlContent = htmlContent.replace(/<br>(?!<\/p>)/gi, '</p><p>');
			
			//leere Nodes entfernen
			while(htmlContent.search(/<(?!br)[a-z]+[^>]*>\s*<\/[a-z]+[^>]*>/g) != -1) {
				htmlContent = htmlContent.replace(/<(?!br)[a-z]+[^>]*>\s*<\/[a-z]+[^>]*>/g, '');
			}
			
			//alert(htmlContent);
			
			//Textfeld mit neuem Inhalt f�llen
			this.content.html(htmlContent);
			
			//paragraphenlosen Inhalt wrappen
			this.content.contents().each(function() {
				if(this.nodeType == 3 || $.inArray(this.tagName.toLowerCase(), o.blockHtmlElements) == -1) {
					$(this).wrap('<p/>');
				}
			});
			
			//Auswahl aufheben
			var range = rangy.createRange();
			range.setStart(document.getElementById('content_field'), 0);
			range.setEnd(document.getElementById('content_field'), 0)
			rangy.getSelection().setSingleRange(range);
			
		},
		//alle Nodes des Textfeldes durchlaufen
		_traverseDOMTree: function(node, level, actionFirst, actionLast) {
			actionFirst(node, level);
			var childs = node.childNodes.length;
			for(var i = 0; i < childs; i++) {
				this._traverseDOMTree(node.childNodes[i], level + 1, actionFirst, actionLast);
			}
			if(actionLast != null) {
				actionLast(node, level);
			}
		},
		//ung�ltige Formatierungen entfernen
		_removeInvalidFormatting: function() {
			var self = this;
			var o = this.options;
			
			this.formatRaw();
			this.formatRaw();
		},
		//formatieren (optional mit CSS-Klasse(n))
		format: function(tag, css) {
			this.formatRaw(tag, (css ? ' class=\"' + css + '\"' : ''));
		},
		//Formatierung entfernen
		clearFormat: function() {
			this.formatRaw('clear', '');
		},
		//alle Formatierungen entfernen
		clearAll: function() {
			this.updateUndoStack(false);
			this.content.html('<p>' + Encoder.htmlEncode(this.content.text()) + '</p>');
		},
		//Auswahl als Link formatieren (optional mit CSS-Klasse(n))
		insertLink: function(url, title, css) {
			this.formatRaw('a', ' href=\"' + url + '\" title=\"' + title + '\"' + (css ? ' class=\"' + css + '\"' : ''));
		},
		undoSystem: {
			stack: [],
			index: 0,
			firstChange: true,
			indexOfLastFirstChange: 0
		},
		pasteLock: false,
		editMode: false,
		options: {
			undoStackSize: 200,										//Gr��e des Undo-Stacks (max. Anzahl an Undo-Operationen)
			inlineHtmlElements:										//HTML-Elemente, die inline eingesetzt werden
				['em', 'strong', 'b', 'span', 'a'],
			blockHtmlElements:										//HTML-Elemente, die als Bl�cke eingesetzt werden
				['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p'],
			validAttrs:												//alle erlaubten Attribute
				['class', 'href', 'title'],
			formatStyles: [],										//Array von Tupeln mit Komponenten: Tag, Classes und Label
			preview: false,											//true: Stylevorschau verwenden, false: einfache Buttons verwenden
			
			//########## CALLBACKS -> werden vom Anwender �berschrieben:
			
			//wird bei Erzeugen des Widgets aufgerufen
			onCreate: function(event, params) {
				var data = params[0];
				var options = params[1];
				var headerHeight = 30;
				var sidebarWidth = 100;
				var buttonWidth = 90;
				var buttonMargin = 3;
				var borderWidth = 1;
				var width = data.element.width();
				var height = data.element.height();
				var contentHeight = height - (2*borderWidth) - headerHeight;
				var contentWidth = width - (2*borderWidth) - sidebarWidth;
				var buttonStyle = { 'width':''+buttonWidth+'px', 'margin':''+buttonMargin+'px' };
				data.content.css({'border-style':'dashed','border-width':''+borderWidth+'px','border-color':'#111111', 'width':''+contentWidth+'px', 'height':''+contentHeight+'px', 'position': 'absolute', 'top':''+headerHeight+'px', 'left':'0px', 'background-color': '#EEEEFF', 'overflow': 'auto'})
						.click(function() {
							data.logic.startEditing();
						});
				data.ui.header = $('<div>').attr('id', 'header')
						.css({'width':''+width+'px', 'height':''+headerHeight+'px', 'position': 'absolute', 'top':'0px', 'left':'0px', 'background-color': '#FFFFFF'})
						.appendTo(data.element);
				data.ui.sidebar = $('<div>').attr('id', 'sidebar')
						.css({'width':''+sidebarWidth+'px', 'height':''+(height-headerHeight)+'px', 'position': 'absolute', 'top':''+headerHeight+'px', 'left':''+(contentWidth+2*borderWidth)+'px', 'background-color': '#FFFFFF'})
						.appendTo(data.element);
				data.ui.acceptButton = $('<input>').attr('id', 'accept_changes_btn').attr('type', 'button').attr('value', 'Accept')
						.css(buttonStyle).css({'background-color':'#11EE11', 'border-color':'#22EE22'})
						.appendTo(data.ui.header)
						.click(function() {
							data.logic.stopEditing(true);
						});
				data.ui.cancelButton = $('<input>').attr('id', 'cancel_changes_btn').attr('type', 'button').attr('value', 'Cancel')
						.css(buttonStyle).css({'background-color':'#EE1111', 'border-color':'#EE2222'})
						.appendTo(data.ui.header)
						.click(function() {
							data.logic.stopEditing(false);
						});
				data.ui.undoButton = $('<input>').attr('id', 'undo_btn').attr('type', 'button').attr('value', 'Undo')
						.css(buttonStyle).css({'background-color':'#EEEEEE'})
						.appendTo(data.ui.header)
						.click(function() {
							data.logic.undo();
						});
				data.ui.redoButton = $('<input>').attr('id', 'redo_btn').attr('type', 'button').attr('value', 'Redo')
						.css(buttonStyle).css({'background-color':'#EEEEEE'})
						.appendTo(data.ui.header)
						.click(function() {
							data.logic.redo();
						});
				data.ui.linkButton = $('<input>').attr('id', 'link_btn').attr('type', 'button').attr('value', 'Link...')
						.css(buttonStyle).css({'float':'top', 'background-color':'#EEEEEE'})
						.appendTo(data.ui.sidebar)
						.click(function() {
							data.logic.defineLink();
						});
				data.ui.clearAllButton = $('<input>').attr('id', 'clear_all_btn').attr('type', 'button').attr('value', 'Clear all')
						.css(buttonStyle).css({'float':'top', 'background-color':'#EEEEEE'})
						.appendTo(data.ui.sidebar)
						.click(function() {
							data.logic.clearAll();
						});
				data.ui.clearFormatButton = $('<input>').attr('id', 'clear_format_btn').attr('type', 'button').attr('value', 'Clear')
						.css(buttonStyle).css({'float':'top', 'background-color':'#EEEEEE'})
						.appendTo(data.ui.sidebar)
						.click(function() {
							data.logic.clearFormat();
						});
				if(options.formatStyles != []) {
					data.ui.formatButtons = new Array(options.formatStyles.length);
					var label;
					for(var i = 0; i < options.formatStyles.length; i++) {
						var tag = options.formatStyles[i][0];
						var classes = options.formatStyles[i][1];
						if(options.formatStyles[i][2] != '') {
							label = options.formatStyles[i][2];
						}
						else {
							label = options.formatStyles[i][0] + ': ' + options.formatStyles[i][1];
						}
						if(options.preview == true) {	
							if(!$.browser.webkit && !$.browser.safari) {
								data.ui.formatButtons[i] = $('<'+options.formatStyles[i][0]+'>').attr('id', 'format_btn_'+i).attr('class', options.formatStyles[i][1]).text(label).disableSelection()
									.css(buttonStyle).css({
										'float':'top', 
										'background-color':'#EEEEEE'
										})
									.appendTo(data.ui.sidebar)
									.bind('click', {tag: options.formatStyles[i][0], classes: options.formatStyles[i][1]}, function(event) { event.preventDefault(); data.logic.format(event.data.tag, event.data.classes); });
							}
							else {	
								data.ui.formatButtons[i] = $('<input>').attr('id', 'format_btn_'+i).attr('type', 'button').attr('value', label).attr('class', options.formatStyles[i][1])
									.css(buttonStyle).css({
										'float':'top', 
										'background-color':'#EEEEEE'
										})
									.appendTo(data.ui.sidebar)
									.bind('click', {tag: options.formatStyles[i][0], classes: options.formatStyles[i][1]}, function(event) { data.logic.format(event.data.tag, event.data.classes); });
							}
						}
						else {
							data.ui.formatButtons[i] = $('<input>').attr('id', 'format_btn_'+i).attr('type', 'button').attr('value', label)
								.css(buttonStyle).css({
									'float':'top', 
									'background-color':'#EEEEEE'
									})
								.appendTo(data.ui.sidebar)
								.bind('click', {tag: options.formatStyles[i][0], classes: options.formatStyles[i][1]}, function(event) { data.logic.format(event.data.tag, event.data.classes); });
						}		
					}
				}
				data.ui.acceptButton.hide();
				data.ui.cancelButton.hide();
				data.ui.undoButton.hide();
				data.ui.redoButton.hide();
				data.ui.linkButton.hide();
				data.ui.clearAllButton.hide();
				data.ui.clearFormatButton.hide();
				if(data.ui.formatButtons.length > 0) {
					for(var i = 0; i < data.ui.formatButtons.length; i++) {
						data.ui.formatButtons[i].hide();
					}
				}
			},
			//wird bei Starten des Editiervorgangs aufgerufen
			onStartEditing: function(event, data) {
				data.ui.acceptButton.fadeIn(1000);
				data.ui.cancelButton.fadeIn(1000);
				data.ui.linkButton.fadeIn(1000);
				data.ui.clearAllButton.fadeIn(1000);
				data.ui.undoButton.fadeIn(1000);
				data.ui.redoButton.fadeIn(1000);
				data.ui.clearFormatButton.fadeIn(1000);
				if(data.ui.formatButtons.length > 0) {
					for(var i = 0; i < data.ui.formatButtons.length; i++) {
						data.ui.formatButtons[i].fadeIn(1000);
					}
				}
				data.content.css({'background-color' : '#FFFFFF'});
			},
			//wird bei Beenden des Editiervorgangs aufgerufen
			onStopEditing: function(event, data) {
				data.ui.acceptButton.fadeOut();
				data.ui.cancelButton.fadeOut();
				data.ui.undoButton.fadeOut();
				data.ui.redoButton.fadeOut();
				data.ui.linkButton.fadeOut();
				data.ui.clearAllButton.fadeOut();
				data.ui.clearFormatButton.fadeOut();
				if(data.ui.formatButtons.length > 0) {
					for(var i = 0; i < data.ui.formatButtons.length; i++) {
						data.ui.formatButtons[i].fadeOut();
					}
				}
				data.content.css({'background-color' : '#EEEEFF'});
			},
			//wird nach einer Undo-Operation aufgerufen
			onUndone: function(event, data) {
				data.ui.redoButton.removeAttr('disabled');
			},
			//wird nach der letztm�glichen Undo-Operation aufgerufen
			onUndoDisabled: function(event, data) {
				data.ui.undoButton.attr('disabled', 'true');
			},
			//wird nach einer Redo-Operation aufgerufen
			onRedone: function(event, data) {
				data.ui.undoButton.removeAttr('disabled');
			},
			//wird nach der letztm�glichen Redo-Operation aufgerufen
			onRedoDisabled: function(event, data) {
				data.ui.redoButton.attr('disabled', 'true');
			},
			//wird bei �nderung des Textes (und somit �nderung des Undo-Redo-Stacks) aufgerufen
			onUndoStackUpdate: function(event, data) {
				data.ui.undoButton.removeAttr('disabled');
				data.ui.redoButton.attr('disabled', 'true');
			},
			//wird aufgerufen, sobald ein Link eingegeben werden soll
			onDefineLink: function(event, data) {
				var url = window.prompt('URL:', 'http://');
				if(url != null) {
					var title = window.prompt('Title (shown while hovering):', url);
					data.logic.insertLink(url, title);
				}
			}
		}
	});
})(jQuery);