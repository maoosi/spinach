
// IMPORTS

const prefixer       = require('autoprefixer')
const sync           = require('browser-sync')
const cssnano        = require('cssnano')
const del            = require('del')
const fs             = require('fs')
const notifier       = require('node-notifier')
const glob           = require('glob-all')
const path           = require('path')
const moduleImporter = require('sass-module-importer')

const gulp           = require('gulp')
const data           = require('gulp-data')
const changed        = require('gulp-changed')
const include        = require('gulp-file-include')
const htmlmin        = require('gulp-htmlmin')
const imagemin       = require('gulp-imagemin')
const plumber        = require('gulp-plumber')
const postcss        = require('gulp-postcss')
const sass           = require('gulp-sass')
const maps           = require('gulp-sourcemaps')
const nunjucks       = require('gulp-nunjucks')
const bulkSass       = require('gulp-sass-bulk-import');
const rename         = require('gulp-rename');

const rollup         = require('rollup')
const babel          = require('rollup-plugin-babel')
const commonjs       = require('rollup-plugin-commonjs')
const resolve        = require('rollup-plugin-node-resolve')
const uglify         = require('rollup-plugin-uglify')
const eslint         = require('rollup-plugin-eslint')


// VARS

const paths = {
	assets: './src/assets',
	views: './src/views',
	data: './src/data',
	dist: './build'
}



// ERROR HANDLER

const onError = function(error) {
	notifier.notify({ 'title': 'Error', 'message': 'Compilation failed.' })
	console.log(error)
    this.emit('end')
}



// CLEAN

gulp.task('clean', () => del(paths.dist))



// HTML

gulp.task('html', ['images'], () => {
    return gulp.src(paths.views + '/*.{html,twig}')
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
        .pipe(include({ prefix: '@', basepath: paths.dist + '/images/' }))
        .pipe(htmlmin({ collapseWhitespace: true, minifyCSS: true, removeComments: true }))
		.pipe(rename(function (path) {
			if (path.basename == 'home') {
				path.basename = 'index'
			}
			path.extname = '.html'
			return path
		}))
        .pipe(gulp.dest(paths.dist))
})



// JS

const read = {
	sourceMap: true,
	plugins: [
		eslint(),
		resolve({ jsnext: true, main: true }),
		commonjs(),
		babel({ exclude: 'node_modules/**' }),
		uglify()
	]
}

const write = {
    format: 'iife',
    sourceMap: true
}

const files = glob.sync([
	paths.assets + '/js/*.js',
	'!' + paths.assets + '/js/_*.js'
])

gulp.task('js', () => {
	let stream

	files.forEach(file => {
		let _read = Object.assign({ entry: file }, read)
		stream = rollup
	        .rollup(_read)
	        .then(bundle => {

	            // generate the bundle
	            let files = bundle.generate(write)

	            // write the files to dist
	            fs.writeFileSync(paths.dist + '/js/' + path.basename(file).replace('.js', '.min.js'), files.code)
	            fs.writeFileSync(paths.dist + '/maps/' + path.basename(file) + '.map', files.map.toString())

	        })
	})

	return stream
})



// SASS

gulp.task('sass', () => {
	return gulp.src([paths.assets + '/sass/*.scss', '!' + paths.assets + '/sass/_*.scss'])
		.pipe(plumber({ errorHandler: onError }))
		.pipe(maps.init())
		.pipe(bulkSass())
		.pipe(sass({ importer: moduleImporter() }))
		.pipe(sass())
		.pipe(postcss([ prefixer({ browsers: 'last 2 versions' }) ]))
		.pipe(postcss([ cssnano({ safe: true }) ]))
		.pipe(rename(function (path) {
			path.extname = '.min.css'
			return path;
		}))
		.pipe(maps.write('../maps', { addComment: false }))
		.pipe(gulp.dest(paths.dist + '/css'))
})



// IMAGES

gulp.task('images', () => {
	return gulp.src(paths.assets + '/images/**/*.{gif,jpg,png,svg}')
		.pipe(plumber({ errorHandler: onError }))
		.pipe(changed(paths.dist + '/images'))
		.pipe(imagemin())
		.pipe(gulp.dest(paths.dist + '/images'))
})



// ASSETS COPY

const others = [
    {
        name: 'fonts',
        src:  '/fonts/**/*',
        dest: '/fonts'
    }, {
        name: 'favicon',
        src:  '/favicon.{ico,png}',
        dest: ''
    }
]

others.forEach(object => {
    gulp.task(object.name, () => {
        return gulp.src(paths.assets + object.src)
            .pipe(plumber({ errorHandler: onError }))
            .pipe(gulp.dest(paths.dist + object.dest))
    })
})



// SERVER

const server = sync.create()
const reload = sync.reload

const sendMaps = (req, res, next) => {
	const filename = req.url.split('/').pop()
	const extension = filename.split('.').pop()

	if(extension === 'css' || extension === 'js') {
		res.setHeader('X-SourceMap', '/maps/' + filename + '.map')
	}

	return next()
}

const options = {
	notify: false,
	startPath: '/index.html',
	server: {
		baseDir: 'build',
		middleware: [
	      sendMaps
	    ]
	},
    watchOptions: {
        ignored: '*.map'
    }
}

gulp.task('server', () => setTimeout(function(){ sync(options) }, 1000))



// WATCH

gulp.task('watch', () => {
    gulp.watch([paths.views + '/**/*.{html,twig}', paths.data + '/**/*.json'], ['html', reload])
    gulp.watch(paths.assets + '/sass/**/*.scss', ['sass', reload])
    gulp.watch(paths.assets + '/js/**/*.js', ['js', reload])
    gulp.watch(paths.assets + '/images/**/*.{gif,jpg,png,svg}', ['images', reload])
})



// BUILD AND DEFAULT TASKS

gulp.task('build', ['clean'], () => {
    fs.mkdirSync(paths.dist)
    fs.mkdirSync(paths.dist + '/js')
    fs.mkdirSync(paths.dist + '/maps')
	fs.mkdirSync(paths.dist + '/images')
    gulp.start('html', 'sass', 'js', 'images', 'fonts', 'favicon')
})

gulp.task('default', ['build', 'server', 'watch'])
