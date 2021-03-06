/* exported tableSelectionHelpers, createPasteTestCase, doCommandTest */

( function() {
	'use strict';

	window.tableSelectionHelpers = {
		getRangesForCells: function( editor, cellsIndexes ) {
			var ranges = [],
				cells = editor.editable().find( 'td, th' ),
				range,
				cell,
				i;

			for ( i = 0; i < cellsIndexes.length; i++ ) {
				range = editor.createRange();
				cell = cells.getItem( cellsIndexes[ i ] );

				range.setStartBefore( cell );
				range.setEndAfter( cell );

				ranges.push( range );
			}

			return ranges;
		},

		/*
		 * Adds a class to selected cells in editable, so that it can be compared in assertions.
		 *
		 * @param {CKEDITOR.dom.range} ranges[] Ranges which cells should be marked.
		 * @param {boolean} [addSelected] Whether to apply `selected` class instead `cke_marked` to the selected cells.
		 */
		markCells: function( ranges, addSelected ) {
			var i;

			for ( i = 0; i < ranges.length; i++ ) {
				ranges[ i ]._getTableElement().addClass( addSelected ? 'selected' : 'cke_marked' );
			}
		},

		/*
		 * Modifies testSuite by adding entries in `_should.ignore` object for each method/property, if
		 * the current environment is not supported.
		 *
		 * @param {Object} testSuite
		 * @param {Boolean} [check] Custom check to be considered in addition to the default one.
		 */
		ignoreUnsupportedEnvironment: function( testSuite, check ) {
			testSuite._should = testSuite._should || {};
			testSuite._should.ignore = testSuite._should.ignore || {};

			for ( var key in testSuite ) {
				if ( ( typeof check !== 'undefined' && !check ) || !this.isSupportedEnvironment ) {
					testSuite._should.ignore[ key ] = true;
				}
			}
		},

		/*
		 * @property {Boolean} isSupportedEnvironment Whether table selection supports current environment.
		 */
		isSupportedEnvironment: !( CKEDITOR.env.ie && CKEDITOR.env.version < 11 )
	};

	function shrinkSelections( editor ) {
		// Shrinks each range into it's inner element, so that range markers are not outside `td` elem.
		var ranges = editor.getSelection().getRanges(),
			i;

		for ( i = 0; i < ranges.length; i++ ) {
			ranges[ i ].shrink( CKEDITOR.SHRINK_TEXT, false );
		}
	}

	/*
	 * Returns a function that will set editor's content to fixtureId, and will emulate paste
	 * of pasteFixtureId into it.
	 */
	window.createPasteTestCase = function( fixtureId, pasteFixtureId ) {
		return function( editor, bot ) {
			bender.tools.testInputOut( fixtureId, function( source, expected ) {
				editor.once( 'paste', function() {
					resume( function() {
						shrinkSelections( editor );
						bender.assert.beautified.html( expected, bender.tools.getHtmlWithSelection( editor ) );
					} );
				}, null, null, 1 );

				bot.setHtmlWithSelection( source );

				bender.tools.emulatePaste( editor, CKEDITOR.document.getById( pasteFixtureId ).getOuterHtml() );

				wait();
			} );
		};
	};

	/*
	 *
	 * @param {Object} bot Editor bot object.
	 * @param {String/Function} action If string: editor command name to be executed. If string simply a function to be
	 * called before the assertion.
	 * @param {Object} options
	 * @param {String} options.case **Required** - id of element provided to `bender.tools.testInputOut`.
	 * @param {Number[]} [options.cells] Indexes of cells to be selected before executing `action`.
	 * @param {Boolean} [options.markCells] Whether selected cells should get `'selected'` class in the output.
	 * @param {Function} [options.customCheck] Custom assertion. Gets editor as an argument.
	 * @param {Boolean} [options.skipCheckingSelection] If `true` no selection will be chekced.
	 */
	window.doCommandTest = function( bot, action, options ) {
		var editor = bot.editor,
			ranges = [],
			output,
			afterRanges,
			i;

		bender.tools.testInputOut( options[ 'case' ], function( source, expected ) {
			bot.setHtmlWithSelection( source );

			if ( options.cells ) {
				ranges = window.tableSelectionHelpers.getRangesForCells( editor, options.cells );
				editor.getSelection().selectRanges( ranges );
				window.tableSelectionHelpers.markCells( ranges );
			}

			if ( typeof action == 'string' ) {
				bot.execCommand( action );
			} else {
				action();
				ranges = editor.getSelection().getRanges();
			}

			if ( options.markCells ) {
				// Mark selected cells to be able later to check if new selection
				// is containing the appropriate cells.
				window.tableSelectionHelpers.markCells( ranges, options.markCells );
			}

			output = bot.getData( true );
			output = output.replace( /\u00a0/g, '&nbsp;' );
			assert.beautified.html( expected, output );

			if ( options.customCheck ) {
				options.customCheck( editor );
			} else if ( !options.skipCheckingSelection ) {
				afterRanges = editor.getSelection().getRanges();
				assert.isTrue( !!editor.getSelection().isFake, 'selection after is fake' );
				assert.isTrue( editor.getSelection().isInTable(), 'selection after is in table' );

				if ( typeof action != 'string' || action.toLowerCase().indexOf( 'merge' ) === -1 ) {
					assert.areSame( ranges.length, afterRanges.length, 'appropriate number of ranges is selected' );

					for ( i = 0; i < ranges.length; i++ ) {
						assert.isTrue( afterRanges[ i ]._getTableElement().hasClass( 'cke_marked' ),
							'appropriate ranges are selected' );
					}
				} else {
					assert.areSame( 1, afterRanges.length, 'appropriate number of ranges is selected' );
				}
			}
		} );
	};
} )();
