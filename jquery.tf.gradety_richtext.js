(function($) {
	$.widget("tf.gradety_rt", {
		_create: function() {
			var self = this;
			var o = this.options;
			
			//Textfeld erzeugen
			this.content = $('<div>').attr('id', 'content_field').appendTo(this.element);
			
			//Textfeld mit Beispieltext füllen
			this.content.html('<p>Beispieltext. Blabla 1 Blabla 2</p><h2>Zwischenüberschrift</h2><p>Noch mehr Beispieltext. <strong>Fetter Text.</strong> Und noch mehr.</p>');
			
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
					/*else if(event.which == 86) {			//STRG-V -> Paste
						self.content.trigger('paste');
						event.preventDefault();
					}*/
					else if(event.which != 65 && event.which != 67 && event.which != 86 && event.which != 88) {		//STRG-A, STRG-C, STRG-V, STRG-X -> einzige Shortcuts mit Standardbelegung
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
					setTimeout(function() {
						self._checkOnEmptiness(event.which);
					}, 0);
				}
			});
			
			//Paste-Event
			this.content.bind('paste', function(event) {
				//Arbeitsschritt speichern
				self.updateUndoStack(false);
				
				//Originaltext und Auswahl speichern
				var originalContent = self.content.html();
				var sel = rangy.getSelection();
				var anchorNode = sel.anchorNode;
				var focusNode = sel.focusNode;
				
				//Index der Auswahl-Nodes speichern (da Nodes als Objekte gelöscht werden)
				var anchorNodeIndex = 0, focusNodeIndex = 0;
				var anchorNodeFound = false, focusNodeFound = false;
				self._traverseDOMTree(document.getElementById('content_field'), function(node) {
					if(anchorNodeFound == false) {
						if(node != anchorNode) {
							anchorNodeIndex++;
						}
						else {
							anchorNodeFound = true;
						}
					}
					if(focusNodeFound == false) {
						if(node != focusNode) {
							focusNodeIndex++;
						}
						else {
							focusNodeFound = true;
						}
					}
				});
				
				var anchorOffset = sel.anchorOffset;
				var focusOffset = sel.focusOffset;
				
				//Textfeld leeren
				self.content.empty();
				
				setTimeout(function() {
					//nach Paste: Inhalt des Textfeldes = neu eingefügter Text
					var pastedText = self.content.html();
					
					//Zustand vor Paste wiederherstellen
					self.content.html(originalContent);
					
					//Auswahl-Nodes anhand Indizes wiederherstellen
					self._traverseDOMTree(document.getElementById('content_field'), function(node) {
						if(anchorNodeIndex == 0) {
							anchorNode = node;
						}
						anchorNodeIndex--;
						if(focusNodeIndex == 0) {
							focusNode = node;
						}
						focusNodeIndex--;
					});
					
					//einzufügenden Text als Paragraph in Textfeld einfügen
					var insertion = {
						anchorNode: anchorNode,
						focusNode: focusNode,
						anchorOffset: anchorOffset,
						focusOffset: focusOffset,
						content: pastedText
					};
					self.formatRaw('insert', '', insertion);
					self._checkOnEmptiness();
				}, 0);
			});
			
			//Cut-Event
			this.content.bind('cut', function(event) {
				//Arbeitsschritt speichern
				self.updateUndoStack(false);
				self._checkOnEmptiness();
			});
			
			//Datenobjekt für Callback-Funktionen
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
					insertLink: function(url, title) { self.insertLink(url, title) },
					format: function(tag) { self.format(tag) },
					formatWithCSS: function(css) { self.formatWithCSS(css) },
					clearFormat: function() { self.clearFormat() },
					clearAll: function() { self.clearAll() }
				}
			};
			
			this._trigger('onCreate', null, this.data);
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
		//Editiervorgang abschließen (mit oder ohne Speicherung)
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
		//leeres Textfeld bei Bedarf mit Standardtext füllen
		_checkOnEmptiness: function(input) {
			var self = this;
			setTimeout(function() {
				if(input == 13) {
					self.content.find('br').replaceWith('&nbsp;');
				}
				else {
					self.content.find('br').replaceWith(' ');
				}
				if($.trim(self.content.text()) == '') {
					self.content.html('<p>' + self.options.defaultText + '</p>');
					var range = rangy.createRange();
					var node = document.getElementById('content_field').firstChild.firstChild;
					range.setStart(node, 0);
					range.setEnd(node, node.data.length);
					rangy.getSelection().setSingleRange(range);
				}
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
		//Arbeitsschritt rückgängig machen
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
		formatRaw: function(tag, attrs, insertion) {
			var self = this;
			var o = this.options;
			
			this.content.focus();
			
			//Auswahldaten aus aktueller Auswahl oder insertion-Objekt (nach Paste-Vorgang -> Einsetzen des neu einzufügenden Textes) beziehen
			var anchorNode, anchorOffset, focusNode, focusOffset;
			if(insertion) {
				tag = 'insert';
				attrs = '';
				anchorNode = insertion.anchorNode;
				anchorOffset = insertion.anchorOffset;
				focusNode = insertion.focusNode;
				focusOffset = insertion.focusOffset;
			}
			else {
				var sel = rangy.getSelection();
				anchorNode = sel.anchorNode;
				anchorOffset = sel.anchorOffset;
				focusNode = sel.focusNode;
				focusOffset = sel.focusOffset;
			}
			
			//Inline- oder Blockformatierung?
			var inline = ($.inArray(tag, o.inlineHtmlElements) != -1 || tag == 'clear') && tag != 'insert';
			
			//Richtung der Auswahl (vorwärts/rückwärts) bestimmen und standardisieren
			var node1, node2, offset1, offset2;
			var foundAnchor = false, foundFocus = false;
			this._traverseDOMTree(document.getElementById('content_field'), function(node) {
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
			});
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
			
			//liegt die Auswahl außerhalb des Textfeldes, Formatieren abbrechen!
			if(foundAnchor == false || foundFocus == false) {
				return;
			}
			
			//Arbeitsschritt speichern
			if(insertion) {} else {
				this.updateUndoStack(false);
			}
			
			
			var htmlContent = "";
			var aLevelNode, bLevelNode, cLevelNode;
			var aLevelNodeTag, bLevelNodeTag, bLevelNodeAttrs;
			var handled1 = false, handled2 = false;
			
			//falls kompletter Textfeld-Inhalt ausgewählt wurde, Auswahl auf ersten und letzten Nachfolger (Textnodes) des Textfeldes reduzieren
			if(node1 == node2 && node1 == document.getElementById('content_field')) {
				while(node1.nodeType == 1) {
					node1 = node1.firstChild;
				}
				offset1 = 0;
				if(tag != 'insert') {
					while(node2.nodeType == 1) {
						node2 = node2.lastChild;
					}
					offset2 = node2.data.length;
				}
				else {
					node2 = node1;
					offset2 = 0;
				}
			}
			
			//alle direkten Nachfolger des Textfeldes (Paragraphen und Headlines -> Level-A-Nodes) durchlaufen
			this.content.contents().each(function() {
				aLevelNode = this;
				aLevelNodeTag = $(aLevelNode).get(0).tagName.toLowerCase();
				
				//falls kompletter Level-A-Node ausgewählt wurde, Auswahl auf ersten und letzten Nachfolger (Textnodes) dieses Nodes reduzieren
				if(node1 == node2 && node1 == aLevelNode) {
					while(node1.nodeType == 1) {
						node1 = node1.firstChild;
					}
					offset1 = 0;
					if(tag != 'insert') {
						while(node2.nodeType == 1) {
							node2 = node2.lastChild;
						}
						offset2 = node2.data.length;
					}
					else {
						node2 = node1;
						offset2 = 0;
					}
				}
				
				//öffnendes Tag des Level-A-Nodes schreiben
				if(inline || handled1 == false || handled2 == true) {
					htmlContent += '<' + aLevelNodeTag + '>';
				}
				
				//alle direkten Nachfolger des Level-A-Nodes durchlaufen
				$(aLevelNode).contents().each(function() {
					
					bLevelNode = this;
					
					//Level-B-Node ist ein Elementnode...
					if(this.nodeType == 1) {
						bLevelNodeTag = $(bLevelNode).get(0).tagName.toLowerCase();
						if(bLevelNodeTag == 'span') {
							bLevelNodeAttrs = ' class=\"' + $(bLevelNode).attr('class') + '\"';
						}
						else if(bLevelNodeTag == 'a') {
							bLevelNodeAttrs = ' href=\"' + $(bLevelNode).attr('href') + '\" title=\"' + $(bLevelNode).attr('title') + '\"';
						}
						else {
							bLevelNodeAttrs = "";
						}
						
						//Level-C-Node ist ein Textnode!
						cLevelNode = this.firstChild;
						
						//Auswahl ausschließlich innerhalb dieses Level-C-Nodes...
						if(node1 == node2 && node1 == cLevelNode) {
							htmlContent += '<' + bLevelNodeTag + bLevelNodeAttrs + '>'
									+ Encoder.htmlEncode(cLevelNode.data.substring(0, offset1)) + '</' + bLevelNodeTag + '>';
							if(inline == false) {
								htmlContent += '</' + aLevelNodeTag + '>';
							}
							htmlContent += '<' + tag + attrs + '>' + Encoder.htmlEncode(cLevelNode.data.substring(offset1, offset2)) + '</' + tag + '>';
							if(inline == false) {
								htmlContent += '<' + aLevelNodeTag + '>';
							}
							htmlContent += '<' + bLevelNodeTag + bLevelNodeAttrs + '>' + Encoder.htmlEncode(cLevelNode.data.substring(offset2, cLevelNode.data.length))
									+ '</' + bLevelNodeTag + '>';
							handled1 = handled2 = true;
						}
						//Auswahl beginnt auf diesem Level-C-Node...
						else if(node1 == cLevelNode) {
							htmlContent += '<' + bLevelNodeTag + bLevelNodeAttrs + '>'
									+ Encoder.htmlEncode(cLevelNode.data.substring(0, offset1)) + '</' + bLevelNodeTag + '>';
							if(inline == false) {
								htmlContent += '</' + aLevelNodeTag + '>';
							}
							htmlContent += '<' + tag + attrs + '>'
									+ Encoder.htmlEncode(cLevelNode.data.substring(offset1, cLevelNode.data.length));
							if(inline && bLevelNode == aLevelNode.lastChild) {
								htmlContent += '</' + tag + '>';
							}
							handled1 = true;
						}
						//Auswahl endet auf diesem Level-C-Node...
						else if(node2 == cLevelNode) {
							if(inline && bLevelNode == aLevelNode.firstChild) {
								htmlContent += '<' + tag + attrs + '>';
							}
							htmlContent += Encoder.htmlEncode(cLevelNode.data.substring(0, offset2)) + '</' + tag + '>';
							if(inline == false) {
								htmlContent += '<' + aLevelNodeTag + '>';
							}
							htmlContent += '<' + bLevelNodeTag + bLevelNodeAttrs + '>'
									+ Encoder.htmlEncode(cLevelNode.data.substring(offset2, cLevelNode.data.length)) + '</' + bLevelNodeTag + '>';
							handled2 = true;
						}
						//Auswahl geht komplett über diesen Level-C-Node...
						else if(handled1 == true && handled2 == false) {
							if(inline && bLevelNode == aLevelNode.firstChild) {
								htmlContent += '<' + tag + attrs + '>';
							}
							htmlContent += Encoder.htmlEncode(cLevelNode.data);
							if(inline && bLevelNode == aLevelNode.lastChild) {
								htmlContent += '</' + tag + '>';
							}
						}
						//Auswahl berührt diesen Level-C-Node nicht...
						else {
							htmlContent += '<' + bLevelNodeTag + bLevelNodeAttrs + '>' + Encoder.htmlEncode(cLevelNode.data) + '</' + bLevelNodeTag + '>';
						}
					}
					//Level-B-Node ist ein Textnode...
					else if(this.nodeType == 3) {
						//Auswahl ausschließlich innerhalb dieses Level-B-Nodes...
						if(node1 == node2 && node1 == bLevelNode) {
							htmlContent += Encoder.htmlEncode(bLevelNode.data.substring(0, offset1));
							if(inline == false) {
								htmlContent += '</' + aLevelNodeTag + '>';
							}
							htmlContent += '<' + tag + attrs + '>' + Encoder.htmlEncode(bLevelNode.data.substring(offset1, offset2)) + '</' + tag + '>';
							if(inline == false) {
								htmlContent += '<' + aLevelNodeTag + '>';
							}
							htmlContent += Encoder.htmlEncode(bLevelNode.data.substring(offset2, bLevelNode.data.length));
							handled1 = handled2 = true;
						}
						//Auswahl beginnt auf diesem Level-B-Node...
						else if(node1 == bLevelNode) {
							htmlContent += Encoder.htmlEncode(bLevelNode.data.substring(0, offset1));
							if(inline == false) {
								htmlContent += '</' + aLevelNodeTag + '>';
							}
							htmlContent += '<' + tag + attrs + '>' + Encoder.htmlEncode(bLevelNode.data.substring(offset1, bLevelNode.data.length));
							if(inline && bLevelNode == aLevelNode.lastChild) {
								htmlContent += '</' + tag + '>';
							}
							handled1 = true;
						}
						//Auswahl endet auf diesem Level-B-Node...
						else if(node2 == bLevelNode) {
							if(inline && bLevelNode == aLevelNode.firstChild) {
								htmlContent += '<' + tag + attrs + '>';
							}
							htmlContent += Encoder.htmlEncode(bLevelNode.data.substring(0, offset2)) + '</' + tag + '>';
							if(inline == false) {
								htmlContent += '<' + aLevelNodeTag + '>';
							}
							htmlContent += Encoder.htmlEncode(bLevelNode.data.substring(offset2, bLevelNode.data.length));
							handled2 = true;
						}
						//Auswahl geht komplett über diesen Level-B-Node...
						else if(handled1 == true && handled2 == false) {
							if(inline && bLevelNode == aLevelNode.firstChild) {
								htmlContent += '<' + tag + attrs + '>';
							}
							htmlContent += Encoder.htmlEncode(bLevelNode.data);
							if(inline && bLevelNode == aLevelNode.lastChild) {
								htmlContent += '</' + tag + '>';
							}
						}
						//Auswahl berührt diesen Level-B-Node nicht...
						else {
							htmlContent += Encoder.htmlEncode(bLevelNode.data);
						}
					}
				});
				
				//schließendes Tag des Level-A-Nodes schreiben
				if(inline || handled1 == false || handled2 == true) {
					htmlContent += '</' + aLevelNodeTag + '>';
				}
				
			});
			
			//Paste-Text einsetzen
			if(insertion) {
				var rawInsertion = insertion.content.replace(/<br[^>]*>/gi, '<-br->');
				rawInsertion = rawInsertion.replace(/<\/?[^-][a-z]*[^>]*>/gi, '');
				var linesToInsert = rawInsertion.split('<-br->');
				var formattedInsertion = '';
				for(var i = 0; i < linesToInsert.length; i++) {
					formattedInsertion += '<p>' + Encoder.htmlEncode(linesToInsert[i]) + '</p>';
				}
				htmlContent = htmlContent.replace(/<insert>[^<]*<\/insert>/i, formattedInsertion);
			}
			
			//leere Nodes und <br>-Tags entfernen
			htmlContent = htmlContent.replace(/<[a-z]+[^>]*><\/[a-z]+[^>]*>/gi, '');
			htmlContent = htmlContent.replace(/<br[^>]*>/gi, '&nbsp;');
			
			//zu löschende Formatierungen entfernen
			htmlContent = htmlContent.replace(/<h([1-6])>([^<]*)<clear>([^<]*)<\/clear>([^<]*)<\/h[1-6]>/gi, '<p>$2$3$4</p>');
			htmlContent = htmlContent.replace(/<clear>([^<]*)<\/clear>/gi, '$1');
			
			//Textfeld mit neuem Inhalt füllen
			this.content.html(htmlContent);
			
			//Auswahl aufheben
			sel.setSingleRange(null);
			
		},
		//alle Nodes des Textfeldes durchlaufen
		_traverseDOMTree: function(node, action) {
			action(node);
			var childs = node.childNodes.length;
			for(var i = 0; i < childs; i++) {
				this._traverseDOMTree(node.childNodes[i], action);
			}
		},
		//einfach formatieren
		format: function(tag) {
			this.formatRaw(tag, '');
		},
		//mit CSS-Klasse formatieren
		formatWithCSS: function(css) {
			this.formatRaw('span', ' class=\"' + css + '\"');
		},
		//Formatierung entfernen
		clearFormat: function() {
			this.formatRaw('clear', '');
		},
		//alle Formatierungen entfernen
		clearAll: function() {
			this.updateUndoStack(false);
			this.content.html('<p>' + this.content.text() + '</p>');
		},
		//Auswahl als Link formatieren
		insertLink: function(url, title) {
			this.formatRaw('a', ' href=\"' + url + '\" title=\"' + title + '\"');
		},
		undoSystem: {
			stack: [],
			index: 0,
			firstChange: true,
			indexOfLastFirstChange: 0
		},
		editMode: false,
		options: {
			styles: [],												//CSS-Klassennamen
			undoStackSize: 200,										//Größe des Undo-Stacks (max. Anzahl an Undo-Operationen)
			inlineHtmlElements:										//HTML-Elemente, die inline eingesetzt werden
				['em', 'strong', 'span', 'a'],
			blockHtmlElements:										//HTML-Elemente, die als Blöcke eingesetzt werden
				['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p'],
			defaultText: 'Enter text here...',						//Standardtext bei leerem Textfeld
			
			//########## CALLBACKS -> werden vom Anwender überschrieben:
			
			//wird bei Erzeugen des Widgets aufgerufen
			onCreate: function(event, data) {
				var headerHeight = 30;
				var sidebarWidth = 100;
				var buttonWidth = 60;
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
				data.ui.header = $("<div>").attr("id", "header")
						.css({'width':''+width+'px', 'height':''+headerHeight+'px', 'position': 'absolute', 'top':'0px', 'left':'0px', 'background-color': '#FFFFFF'})
						.appendTo(data.element);
				data.ui.sidebar = $("<div>").attr("id", "sidebar")
						.css({'width':''+sidebarWidth+'px', 'height':''+(height-headerHeight)+'px', 'position': 'absolute', 'top':''+headerHeight+'px', 'left':''+(contentWidth+2*borderWidth)+'px', 'background-color': '#FFFFFF'})
						.appendTo(data.element);
				data.ui.acceptButton = $("<input>").attr("id", "accept_changes_btn").attr("type", "button").attr("value", "Accept")
						.css(buttonStyle).css({'background-color':'#11EE11', 'border-color':'#22EE22'})
						.appendTo(data.ui.header)
						.click(function() {
							data.logic.stopEditing(true);
						});
				data.ui.cancelButton = $("<input>").attr("id", "cancel_changes_btn").attr("type", "button").attr("value", "Cancel")
						.css(buttonStyle).css({'background-color':'#EE1111', 'border-color':'#EE2222'})
						.appendTo(data.ui.header)
						.click(function() {
							data.logic.stopEditing(false);
						});
				data.ui.undoButton = $("<input>").attr("id", "undo_btn").attr("type", "button").attr("value", "Undo")
						.css(buttonStyle).css({'background-color':'#EEEEEE'})
						.appendTo(data.ui.header)
						.click(function() {
							data.logic.undo();
						});
				data.ui.redoButton = $("<input>").attr("id", "redo_btn").attr("type", "button").attr("value", "Redo")
						.css(buttonStyle).css({'background-color':'#EEEEEE'})
						.appendTo(data.ui.header)
						.click(function() {
							data.logic.redo();
						});
				data.ui.linkButton = $("<input>").attr("id", "link_btn").attr("type", "button").attr("value", "Link...")
						.css(buttonStyle).css({'float':'top', 'background-color':'#EEEEEE'})
						.appendTo(data.ui.sidebar)
						.click(function() {
							data.logic.defineLink();
						});
				data.ui.clearAllButton = $("<input>").attr("id", "clear_all_btn").attr("type", "button").attr("value", "Clear all")
						.css(buttonStyle).css({'float':'top', 'background-color':'#EEEEEE'})
						.appendTo(data.ui.sidebar)
						.click(function() {
							data.logic.clearAll();
						});
				data.ui.formatButton1 = $("<input>").attr("id", "format_btn_1").attr("type", "button").attr("value", "h1")
						.css(buttonStyle).css({'float':'top', 'background-color':'#EEEEEE'})
						.appendTo(data.ui.sidebar)
						.click(function() {
							data.logic.format('h1');
						});
				data.ui.formatButton2 = $("<input>").attr("id", "format_btn_2").attr("type", "button").attr("value", "em")
						.css(buttonStyle).css({'float':'top', 'background-color':'#EEEEEE'})
						.appendTo(data.ui.sidebar)
						.click(function() {
							data.logic.format('em');
						});
				data.ui.formatButton3 = $("<input>").attr("id", "format_btn_3").attr("type", "button").attr("value", "strong")
						.css(buttonStyle).css({'float':'top', 'background-color':'#EEEEEE'})
						.appendTo(data.ui.sidebar)
						.click(function() {
							data.logic.format('strong');
						});
				data.ui.formatButton4 = $("<input>").attr("id", "format_btn_4").attr("type", "button").attr("value", "red")
						.css(buttonStyle).css({'float':'top', 'background-color':'#EEEEEE'})
						.appendTo(data.ui.sidebar)
						.click(function() {
							data.logic.formatWithCSS('red');
						});
				data.ui.clearFormatButton = $("<input>").attr("id", "clear_format_btn").attr("type", "button").attr("value", "Clear")
						.css(buttonStyle).css({'float':'top', 'background-color':'#EEEEEE'})
						.appendTo(data.ui.sidebar)
						.click(function() {
							data.logic.clearFormat();
						});
				data.ui.acceptButton.hide();
				data.ui.cancelButton.hide();
				data.ui.undoButton.hide();
				data.ui.redoButton.hide();
				data.ui.linkButton.hide();
				data.ui.clearAllButton.hide();
				data.ui.formatButton1.hide();
				data.ui.formatButton2.hide();
				data.ui.formatButton3.hide();
				data.ui.formatButton4.hide();
				data.ui.clearFormatButton.hide();
			},
			//wird bei Starten des Editiervorgangs aufgerufen
			onStartEditing: function(event, data) {
				data.ui.acceptButton.fadeIn(1000);
				data.ui.cancelButton.fadeIn(1000);
				data.ui.linkButton.fadeIn(1000);
				data.ui.clearAllButton.fadeIn(1000);
				data.ui.undoButton.fadeIn(1000);
				data.ui.redoButton.fadeIn(1000);
				data.ui.formatButton1.fadeIn(1000);
				data.ui.formatButton2.fadeIn(1000);
				data.ui.formatButton3.fadeIn(1000);
				data.ui.formatButton4.fadeIn(1000);
				data.ui.clearFormatButton.fadeIn(1000);
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
				data.ui.formatButton1.fadeOut();
				data.ui.formatButton2.fadeOut();
				data.ui.formatButton3.fadeOut();
				data.ui.formatButton4.fadeOut();
				data.ui.clearFormatButton.fadeOut();
				data.content.css({'background-color' : '#EEEEFF'});
			},
			//wird nach einer Undo-Operation aufgerufen
			onUndone: function(event, data) {
				data.ui.redoButton.removeAttr('disabled');
			},
			//wird nach der letztmöglichen Undo-Operation aufgerufen
			onUndoDisabled: function(event, data) {
				data.ui.undoButton.attr('disabled', 'true');
			},
			//wird nach einer Redo-Operation aufgerufen
			onRedone: function(event, data) {
				data.ui.undoButton.removeAttr('disabled');
			},
			//wird nach der letztmöglichen Redo-Operation aufgerufen
			onRedoDisabled: function(event, data) {
				data.ui.redoButton.attr('disabled', 'true');
			},
			//wird bei Änderung des Textes (und somit Änderung des Undo-Redo-Stacks) aufgerufen
			onUndoStackUpdate: function(event, data) {
				data.ui.undoButton.removeAttr('disabled');
				data.ui.redoButton.attr('disabled', 'true');
			},
			//wird aufgerufen, sobald ein Link eingegeben werden soll
			onDefineLink: function(event, data) {
				var url = window.prompt("URL:", "http://");
				if(url != null) {
					var title = window.prompt("Title (shown while hovering):", url);
					data.logic.insertLink(url, title);
				}
			}
		}
	});
})(jQuery);