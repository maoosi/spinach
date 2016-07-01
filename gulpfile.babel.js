
// import packages
const prefixer       = require('autoprefixer')
const browserSync    = require('browser-sync')
const cssnano        = require('cssnano')
const del            = require('del')
const fs             = require('fs')
const notifier       = require('node-notifier')
const glob           = require('glob-all')
const path           = require('path')
const moduleImporter = require('sass-module-importer')
const runSequence    = require('run-sequence')

const gulp           = require('gulp')
const data           = require('gulp-data')
const changed        = require('gulp-changed')
const htmlmin        = require('gulp-htmlmin')
const imagemin       = require('gulp-imagemin')
const plumber        = require('gulp-plumber')
const postcss        = require('gulp-postcss')
const sass           = require('gulp-sass')
const nunjucks       = require('gulp-nunjucks')
const bulkSass       = require('gulp-sass-bulk-import')
const rename         = require('gulp-rename')
const uglify         = require('gulp-uglify')

const webpack        = require('gulp-webpack')


// global vars
const serverPort = 8080;
const paths = {
	assets: './src/assets',
	views: './src/views',
	data: './src/data',
	dist: './dist'
}


// errors handler
const onError = function(error) {
	notifier.notify({
        'title': 'Error',
        'message': 'Compilation failed.'
    })
	console.log(error)
    this.emit('end')
}


// clean the dist folder
gulp.task('clean', () => del(paths.dist))


// html templating - nunjucks and data injection
gulp.task('html', () => {
    return gulp.src(paths.views + '/*.{html,twig,nunjucks}')
        .pipe(plumber({ errorHandler: onError }))
        .pipe(data(function(file) {
			let pageName = path.basename(file.path, path.extname(file.path))

            let globalData = fs.readFileSync(paths.data + '/_.json', 'utf-8') || {}
			let pageData = fs.readFileSync(paths.data + '/' + pageName + '.json', 'utf-8') || {}

            let jsonData = {
				'_': JSON.parse(globalData),
				pageName: JSON.parse(pageData)
			}

			return jsonData
	    }))
        .pipe(nunjucks.compile())
        .pipe(htmlmin({
            collapseWhitespace: true,
            minifyCSS: true,
            removeComments: true
        }))
		.pipe(rename(function (path) {
			path.extname = '.html'
			return path
		}))
        .pipe(gulp.dest(paths.dist))
        .pipe(server.reload({ stream: true }))
})

// javascript compiler
gulp.task('js', () => {
    gulp.src([paths.assets + '/js/*.js', '!' + paths.assets + '/js/_*.js'])
        .pipe(webpack({
            output: {
                filename: '[name].min.js',
            },
            resolveLoader: {
                fallback: [path.join(__dirname, '../node_modules')]
            },
            module: {
                preLoaders: [
                    {
                        test: /\.js$/,
                        loader: 'eslint',
                        exclude: /(node_modules|libs)/
                    }
                ],
                loaders: [
                    {
                        test: /\.js$/,
                        loader: 'babel',
                        exclude: /node_modules/
                    },
                ]
            }
        }))
        .pipe(uglify())
        .pipe(gulp.dest(paths.dist + '/js/'))
        .pipe(server.reload({ stream: true }));
})


// sass compiler
gulp.task('sass', () => {
	return gulp.src([paths.assets + '/sass/*.scss', '!' + paths.assets + '/sass/_*.scss'])
		.pipe(plumber({ errorHandler: onError }))
		.pipe(bulkSass())
		.pipe(sass({ importer: moduleImporter() }))
		.pipe(sass())
		.pipe(postcss([ prefixer({
            browsers: '> 5%, last 3 versions, ie >= 8'
        }) ]))
		.pipe(postcss([ cssnano({ safe: true }) ]))
		.pipe(rename(function (path) {
			path.extname = '.min.css'
			return path;
		}))
		.pipe(gulp.dest(paths.dist + '/css'))
        .pipe(server.reload({ stream: true }))
})


// images compilation
gulp.task('images', () => {
	return gulp.src(paths.assets + '/images/**/*.{gif,jpg,png,svg}')
		.pipe(plumber({ errorHandler: onError }))
		.pipe(changed(paths.dist + '/images'))
		.pipe(imagemin())
		.pipe(gulp.dest(paths.dist + '/images'))
        .pipe(server.reload({ stream: true }))
})


// copy of static assets
const others = [{
    name: 'fonts',
    src:  '/fonts/**/*',
    dest: '/fonts'
}, {
    name: 'favicon',
    src:  '/favicon.{ico,png}',
    dest: ''
}]
others.forEach(object => {
    gulp.task(object.name, () => {
        return gulp.src(paths.assets + object.src)
            .pipe(plumber({ errorHandler: onError }))
            .pipe(gulp.dest(paths.dist + object.dest))
    })
})


// local dev. server
const server = browserSync.create()
gulp.task('browser-sync', () => server.init({
    notify: false,
    port: serverPort,
	startPath: '/index.html',
	server: {
		baseDir: 'dist'
	}
}))


// watcher
gulp.task('watch', () => {
    gulp.watch([paths.views + '/**/*.{html,twig,nunjucks}', paths.data + '/**/*.json'], ['html'])
    gulp.watch(paths.assets + '/sass/**/*.scss', ['sass'])
    gulp.watch(paths.assets + '/js/**/*.js', ['js'])
    gulp.watch(paths.assets + '/images/**/*.{gif,jpg,png,svg}', ['images'])
})


// build gulp task
gulp.task('build', ['clean'], (callback) => {
    fs.mkdirSync(paths.dist)
    fs.mkdirSync(paths.dist + '/js')
	fs.mkdirSync(paths.dist + '/images')
    runSequence('html', 'sass', 'js', 'images', 'fonts', 'favicon', callback)
})


// default task
gulp.task('default', function (callback) {
    runSequence('build', 'browser-sync', 'watch', callback)
})
