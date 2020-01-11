(function($$) {
    var BOMB_DEATH          =  9;
    var BOMB_FLAGGED        = 10;
    var BOMB_QUESTION       = 11;
    var BOMB_REVEALED       = 12;
    var BOMB_MISFLAGGED     = 13;
    var BLANK               = -1;

    var default_settings = {
        images_dir: 'images/',
        images_extension: '.gif',
        images_width: 16,
        images_height: 16,
        width: 100,
        height: 100,
        num_bombs: 40,
        seed: undefined,
        display_driver: 'canvas',
        border_size: 10
    };

    function get_mouse_position(e, obj) {
        var posx = 0;
        var posy = 0;
        if (!e) var e = window.event;
        e.preventDefault();
        if (e.pageX || e.pageY) 	{
            posx = e.pageX;
            posy = e.pageY;
        } else if (e.clientX || e.clientY) 	{
            posx = e.clientX + document.body.scrollLeft
                   + document.documentElement.scrollLeft;
            posy = e.clientY + document.body.scrollTop
                   + document.documentElement.scrollTop;
        }
        if (obj.offsetParent) {
            do {
                posx -= obj.offsetLeft;
                posy  -= obj.offsetTop;
            } while (obj = obj.offsetParent);
        }
        return { x: posx, y: posy };
    }

    $$.ShellSweeper = function(parent, options) {
        var settings = {};
        for(var opt in default_settings)
            settings[opt] = default_settings[opt];
        for(opt in options)
            settings[opt] = options[opt];

        this.settings = settings;
        this.parent = parent;

        this.random_generator = new MersenneTwister19937();
        this.start_time = undefined;
        this.end_time = undefined;
        this.game_over = false;
        this.bomb_count = undefined;
        this.open_spaces = undefined;

        var seed = settings.seed;
        if (seed === undefined) {
            seed = (new Date()).getTime();
        }
        this.random_generator.init_genrand(seed);

        this.state = new Array(settings.height + 2);
        this.old_state = new Array(settings.height + 2);
        this.board = new Array(settings.height + 2);

        for(var i = 0; i <= settings.height + 1; i++) {
            this.state[i] = new Array(settings.width + 2);
            this.old_state[i] = new Array(settings.width + 2);
            this.board[i] = new Array(settings.width + 2);

            for(var j = 0; j <= settings.width + 1; j++) {
                this.state[i][j] = this.old_state[i][j] = BLANK;
                this.board[i][j] = 0;
            }
        }
        document.oncontextmenu = function() { return false; }
    };

    $$.ShellSweeper.prototype = {
        create_board: function() {
            var self = this;
            var settings = self.settings;
            for(var k = 0; k < settings.num_bombs;) {
                var i = 1 + (self.random_generator.genrand_int32() % settings.height);
                var j = 1 + (self.random_generator.genrand_int32() % settings.width);
                if (self.board[i][j] !== 9) {
                    self.board[i][j] = 9; k++;
                }
            }

            for(i = 1; i <= settings.height; i++) {
                for(j = 1; j <= settings.width; j++) {
                    if (self.board[i][j] === 9) continue;

                    k = 0;
                    for(var ii = -1; ii <= 1; ii++) {
                        for(var jj = -1; jj <= 1; jj++) {
                            if ((ii === 0) && (jj === 0)) continue;
                            if (self.board[i+ii][j+jj] === 9) k++;
                        }
                    }
                    self.board[i][j] = k;                   
                }
            }
            self.bomb_count = settings.num_bombs;
            self.open_spaces = settings.width * settings.height;
        },

        start: function() {
            var self = this;
            var settings = self.settings;

            var display_driver = display_drivers[settings.display_driver];
            self.display_driver = new display_driver(self);

            self.game_over = false;
            self.create_board();

            self.preload_images(function() {
                self.display_driver.build_ui();
            });
        },

        reset: function() {
            var self = this;
            var settings = self.settings;
            for(var i = 1; i <= settings.height; i++) {
                for(var j = 1; j <= settings.width; j++) {
                    self.state[i][j] = self.old_state[i][j] = BLANK;
                }
            }
            self.start_time = undefined;
            self.end_time = undefined;
            self.game_over = false;
            self.bomb_count = settings.num_bombs;
            self.open_spaces = settings.width * settings.height;
            self.display_driver.refresh_ui(true);
        },

        preload_images: function(callback) {
            var self = this;
            var width = self.settings.images_width, height = self.settings.images_height;
            var extension = self.settings.images_extension;
            var images_dir = self.settings.images_dir;
            var num_loaded = 0;

            function on_load() {
                num_loaded++;
                if (num_loaded === 31) {
                    callback.call(self);
                }
            }

            function create_image(file) {
                var img = new Image(width, height);
                img.onload = on_load;
                img.src = images_dir + file + extension;
                return img;
            }

            // preload images: 9 open tiles (0..8)
            self.images = {};
            var images = self.images;

            images.cell = new Array(9);
            for (i = 0; i <= 8; i++) {
                images.cell[i] = create_image('board_' + i);
            }

            images.digit = new Array(10);
            for (i = 0; i <= 9; i++) {
                images.digit[i] = create_image('digit_' + i);
            }
            images.minus = create_image('minus');

            images.death = create_image('board_death');
            images.flagged = create_image('board_flagged');
            images.question = create_image('board_question');
            images.revealed = create_image('board_revealed');
            images.misflagged = create_image('board_misflagged');
            images.blank = create_image('board_blank');

            images.bordertl = create_image('bordertl');
            images.bordertr = create_image('bordertr');
            images.borderbl = create_image('borderbl');
            images.borderbr = create_image('borderbr');
            images.borderlr = create_image('borderlr');
            images.bordertb = create_image('bordertb');
        },

        get_image_by_state: function(state) {
            var self = this;
            switch(state) {
            case 0: case 1: case 2: case 3: case 4: case 5: case 6: case 7: case 8:
                return self.images.cell[state];
            case BLANK:
                return self.images.blank;
            case BOMB_DEATH:
                return self.images.death;
            case BOMB_FLAGGED:
                return self.images.flagged;
            case BOMB_QUESTION:
                return self.images.question;
            case BOMB_REVEALED:
                return self.images.revealed;
            case BOMB_MISFLAGGED:
                return self.images.misflagged;
            }
            return undefined;
        },

        on_click: function(row, column, click_type) {
            var self = this;
            if (self.game_over) { return; }
            var state = self.state[row][column];
            if (click_type === 1) { /* Right click */
                if (state === BLANK) {
                    state = BOMB_FLAGGED;
                    self.bomb_count--;
                } else if (state === BOMB_FLAGGED) {
                    state = BOMB_QUESTION;
                    self.bomb_count++;
                } else if (state === BOMB_QUESTION) {
                    state = BLANK;
                }
                self.state[row][column] = state;
            } else if (click_type === 0) { /* Left click */
                if (self.start_time === undefined) {
                    self.start_time = new Date();
                    self.display_driver.on_game_start();
                }
				if (state === BLANK || state === BOMB_QUESTION) {
                    self.open_cell(row, column);
                } else if (state !== BOMB_FLAGGED) {
                    self.open_all_unmarked(row, column);
                } 
            }
            var settings = self.settings;
            if (settings.num_bombs === self.open_spaces &&
                self.bomb_count === 0) {
                self.end_game();
            }
            self.display_driver.refresh_ui();
        },

        open_all_unmarked: function(row, column) {
            var self = this;
            var settings = self.settings;
            var k = 0;
            for(var ii = -1; ii <= 1; ii++) {
                for(var jj = -1; jj <= 1; jj++) {
                    if ((ii === 0) && (jj === 0)) continue;
                    if (self.state[row+ii][column+jj] === BOMB_FLAGGED)
                        k++;
                }
            }
            if (self.state[row][column] === k) {
                for(ii = -1; ii <= 1; ii++) {
                    if ((row + ii) === 0 || (row + ii) > settings.height) continue;
                    for(jj = -1; jj <= 1; jj++) {
                        if ((ii === 0) && (jj === 0)) continue;
                        if ((column + jj) === 0 || (column + jj) > settings.width) continue;
                        if (self.state[row+ii][column+jj] === BLANK ||
                            self.state[row+ii][column+jj] === BOMB_QUESTION) {
                            self.open_cell(row+ii, column+jj);
                            if (self.game_over) break;
                        }
                    }
                }
            }
        },

        open_cell: function(row, column) {
            var self = this;
            self.state[row][column] = self.board[row][column];
            if (self.state[row][column] === 9) {
                self.end_game();
                return;
            }

            var settings = self.settings;
            var queue_row = [], queue_column = [];
            queue_row[0] = row; queue_column[0] = column;
            var size = 1, k = 0;
            while(k < size) {
                self.open_spaces--;
                row = queue_row[k];
                column = queue_column[k];
                if (self.board[row][column] === 0) {
                    for(ii = -1; ii <= 1; ii++) {
                       if ((row + ii) === 0 || (row + ii) > settings.height) continue;
                       for(jj = -1; jj <= 1; jj++) {
                           if ((column + jj) === 0 || (column + jj) > settings.width) continue;
                           if (self.state[row + ii][column + jj] === BLANK ||
                               self.state[row + ii][column + jj] === BOMB_QUESTION) {
                               queue_row[size] = row + ii;
                               queue_column[size] = column + jj;
                               self.state[row+ii][column+jj] = self.board[row+ii][column+jj];
                               size++;
                           }
                       }
                    }
                }
                k++;
            }
        },

        end_game: function() {
            var self = this;
            var settings = self.settings;
            self.game_over = true;
            self.end_time = new Date();
            var win = true;
            for(var i = 1; i <= settings.height; i++) {
                for(var j = 1; j <= settings.width; j++) {
                    if (self.board[i][j] === 9) {
                        if (self.state[i][j] === BLANK ||
                            self.state[i][j] === BOMB_QUESTION) {
                            self.state[i][j] = BOMB_REVEALED;
                            win = false;
                        }
                    } else {
                        if (self.state[i][j] === BOMB_FLAGGED) {
                            self.state[i][j] = BOMB_MISFLAGGED;
                            win = false;
                        } else if (self.state[i][j] == BOMB_DEATH) {
                            win = false;
                        }
                    }
                }
            }
            self.settings.on_end.call(self, win, Math.floor((self.end_time - self.start_time) / 1000));
        },

        destroy: function() {
            var self = this;
            self.display_driver.destroy();
        }
    };

    var CanvasDriver = function(game) {
        this.game = game;
        this.timer = undefined;
        this.canvas = undefined;
        this.ctx = undefined;
    };

    CanvasDriver.prototype = {
        build_ui: function() {
            var self = this;
            var game = self.game;
            var settings = game.settings;
            var root = game.parent;

            var inner_width = settings.width * settings.images_width;
            var inner_height = settings.height * settings.images_height;

            var width = inner_width + 2 * settings.border_size + 200;
            var height = inner_height + 2 * settings.border_size;

            var html = '<canvas id="board_canvas" width="' + width + '" height="' + height + '"></canvas>';

            root.style.visibility = 'hidden';
            root.innerHTML = html;

            var border = settings.border_size;
            self.canvas = document.getElementById('board_canvas');
            self.canvas.onmousedown = function(e) {
                return false;
            };

            self.canvas.onmouseup = function(e) {
                var pos = get_mouse_position(e, self.canvas);
                if (pos.x >= border && pos.y >= border &&
                    pos.x < border + inner_width &&
                    pos.y < border + inner_height) {

                    var column = Math.floor((pos.x - border) / settings.images_width);
                    var row = Math.floor((pos.y - border) / settings.images_height);

                    game.on_click(row + 1, column + 1, (e.button == 2) ? 1 : 0);
                } else {
                    if (game.bomb_count === 0) {
                        game.end_game();
                    }
                }
            };

            var ctx = self.ctx = self.canvas.getContext('2d');
            for(var i = 0; i < settings.width; i++) {
                ctx.drawImage(game.images.bordertb, border + i * settings.images_width, 0);
                ctx.drawImage(game.images.bordertb, border + i * settings.images_width, inner_height + border);
            }
            for(i = 0; i < settings.height; i++) {
                ctx.drawImage(game.images.borderlr, 0, border + i * settings.images_height);
                ctx.drawImage(game.images.borderlr, inner_width + border, border + i * settings.images_height);
            }
            ctx.drawImage(game.images.bordertl, 0, 0);
            ctx.drawImage(game.images.bordertr, border + inner_width, 0);
            ctx.drawImage(game.images.borderbl, 0, border + inner_height);
            ctx.drawImage(game.images.borderbr, border + inner_width, border + inner_height);

            self.refresh_ui(true);
            self.update_clock();

            root.style.width = width + 'px';
            root.style.visibility = 'visible';
        },

        on_game_start: function() {
            var self = this;
            self.timer = setInterval(function() {
                self.update_clock();
            }, 1000);
        },

        refresh_ui: function(first) {
            var self = this;
            var game = self.game;
            var settings = game.settings;
            var ctx = self.ctx;
            ctx.save();
            ctx.translate(settings.border_size, settings.border_size);
            for(var i = 1; i <= settings.height; i++) {
                for(var j = 1; j <= settings.width; j++) {
                    var state = game.state[i][j];
                    if (!first && (state === game.old_state[i][j])) continue;
                    game.old_state[i][j] = state;
                    var img = game.get_image_by_state(state);
                    var y = (i - 1) * settings.images_height;
                    var x = (j - 1) * settings.images_width;
                    ctx.drawImage(img, x, y);
                }
            }
            ctx.translate(2 * settings.border_size + settings.images_width * settings.width + 58, 140);
            var img1, img2, img3;
            if (game.bomb_count < 0) {
                img1 = game.images.minus;
                img2 = game.images.digit[Math.floor((-game.bomb_count) / 10) % 10];
                img3 = game.images.digit[(-game.bomb_count) % 10];
            } else {
                img1 = game.images.digit[Math.floor((game.bomb_count) / 100) % 10];
                img2 = game.images.digit[Math.floor((game.bomb_count) / 10) % 10];
                img3 = game.images.digit[(game.bomb_count) % 10];
            }
            ctx.drawImage(img1, 0, 0);
            ctx.drawImage(img2, 13, 0);
            ctx.drawImage(img3, 26, 0);
            ctx.restore();
        },

        update_clock: function() {
            var self = this;
            var now = new Date();
            var ctx = self.ctx;
            var game = self.game;
            var settings = game.settings;

            ctx.save();

            ctx.translate(settings.width * settings.images_width + settings.border_size + 25, 0);

            ctx.clearRect(0,0,150,150);
            ctx.translate(75,75);
            ctx.scale(0.4,0.4);
            ctx.rotate(-Math.PI/2);
            ctx.strokeStyle = "black";
            ctx.fillStyle = "white";
            ctx.lineWidth = 8;
            ctx.lineCap = "round";

            // Hour marks
            ctx.save();
            for (var i=0;i<12;i++){
                ctx.beginPath();
                ctx.rotate(Math.PI/6);
                ctx.moveTo(100,0);
                ctx.lineTo(120,0);
                ctx.stroke();
            }
            ctx.restore();

            // Minute marks
            ctx.save();
            ctx.lineWidth = 5;
            for (i=0;i<60;i++){
                if (i%5!=0) {
                    ctx.beginPath();
                    ctx.moveTo(117,0);
                    ctx.lineTo(120,0);
                    ctx.stroke();
                }
                ctx.rotate(Math.PI/30);
            }
            ctx.restore();
  
            var sec;
            var min;
            var hr;
            if (!game.start_time) {
                hr = min = sec = 0;
            } else {
                var now;
                if (!game.end_time) {
                    now = new Date();
                } else {
                    now = game.end_time;
                }
                now -= game.start_time;
                now /= 1000;
                sec = Math.floor(now) % 60;
                now = (now - sec) / 60;
                min = Math.floor(now) % 60;
                now = (now - min) / 60;
                hr = Math.floor(now) % 12;
            }

            ctx.fillStyle = "black";

            // write Hours
            ctx.save();
            ctx.rotate( hr*(Math.PI/6) + (Math.PI/360)*min + (Math.PI/21600)*sec )
            ctx.lineWidth = 14;
            ctx.beginPath();
            ctx.moveTo(-20,0);
            ctx.lineTo(80,0);
            ctx.stroke();
            ctx.restore();

            // write Minutes
            ctx.save();
            ctx.rotate( (Math.PI/30)*min + (Math.PI/1800)*sec )
            ctx.lineWidth = 10;
            ctx.beginPath();
            ctx.moveTo(-28,0);
            ctx.lineTo(112,0);
            ctx.stroke();
            ctx.restore();
  
            // Write seconds
            ctx.save();
            ctx.rotate(sec * Math.PI/30);
            ctx.strokeStyle = "#D40000";
            ctx.fillStyle = "#D40000";
            ctx.lineWidth = 6;
            ctx.beginPath();
            ctx.moveTo(-30,0);
            ctx.lineTo(83,0);
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(0,0,10,0,Math.PI*2,true);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(95,0,10,0,Math.PI*2,true);
            ctx.stroke();
            ctx.fillStyle = "#555";
            ctx.arc(0,0,3,0,Math.PI*2,true);
            ctx.fill();
            ctx.restore();

            ctx.beginPath();
            ctx.lineWidth = 14;
            ctx.strokeStyle = '#325FA2';
            ctx.arc(0,0,142,0,Math.PI*2,true);
            ctx.stroke();

            ctx.restore();
        },

        destroy: function() {
            var self = this;
            var game = self.game;
            var root = game.parent;
            clearInterval(self.timer);
            root.innerHTML = '';
        }
    };

    var display_drivers = {};
    display_drivers['canvas'] = CanvasDriver;

})(window);
