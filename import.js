/**
* @desc nodejs 动态模块更新  nodejs dynamic module exchange, reloader and auto - namespace-generation
* var loader = require('./import');
* loader.require( path) // 导出文件对象，根据路径并且生成命名空间
* loader.wacth( dirname ， true) //监听文件夹变化，并且生成或改变命名空间
* loader.scan(dirname , options) //递归扫描文件夹及子文件夹，返回所有文件，并且可选择监控所有文件，并自动生成命名空间
* @author liandong.org
* @email liu@liandong.org
*/

var fs = require('fs');
var me = {};

/**
 * @desc: 导入文件，并引入命名空间
 * @param{string} pathname 文件的路径，可以是绝对路径和相对路径，决定文件对象的命名空间路径
 * @param{string} start    文件路径的前缀，用于出去绝对路径部分，默认为程序当前路径
 * @return{object} 返回导入的文件对象，如果为空返回null
 */
me.require = function(pathname, start) {
    if (!pathname) {
        return;
    }
    start || ( start = __dirname);
    pathspace = pathname;
    pathspace = pathname.replace(start, '');

    var arr = pathspace.split(/[\/\\]+/g);
    while (arr[0] == '' || arr[0] == '.') {
        arr.shift();
    }

    var target = arr.pop();
    target = target.replace('.js', '');

    var cur = global;
    for (var i = 0; i < arr.length; i++) {
        var item = arr[i];
        if (!cur[item]) {
            cur[item] = {};
        }
        cur = cur[item];
    }
    cur[target] = require(pathname);
    return cur[target];
}
/**
 * @desc 由于文件事件会触发多次的原因，在文件变化的时候会触发两次或多次(在write模式下<open, write>，append模式不会)
 */
function OddEventChecker() {
    var stamp = {};
    var ctime = null;

    /**
     * @desc check 判断是否有效事件，如果相同事件源，且时间差小于一定值，则视为无效事件
     * @param{string} event事件
     * @param{string} filename文件名
     * @time{Date}    时间对象
     *  */
    this.check = function(event, filename, time) {
        var item = event + filename;
        if ( item in stamp) {
            var ctime = stamp[item];
            var span = time - ctime;
            if (span < 100) {
                return false;
            }
        }
        stamp[item] = time;
        return true;
    }
}

var oddChecker = new OddEventChecker();
/**
 * @desc: 监控文件变化，如果文件模块发生变化，则重新载入命名空间
 * @param{string} file 文件路径, 可以是文件，或文件夹，如果是文件夹则对其子文件或文件夹有监控作用
 * @param{function} 回调函数，默认为null， 第一个参数为文件获得的对象，第二个参数为文件绝对路径
 * @param{boolean} namespace是否导入命名空间，如果true选择导入命名空间，否则直接引入文件对象 ,默认为false
 *
 */
me.watch = function(file, recall, namespace) {
    var localPath = require.resolve(file);
    fs.watch(localPath, function(event, filename) {
        var odd = oddChecker.check(event, filename, new Date());
        if (odd && filename && event == 'change') {
            var abs = require.resolve(localPath + '/' + filename);
            delete require.cache[abs];
            //文件的删除，增加，移动会触发相关文件夹的头新修改
            var stat = fs.lstatSync(abs);
            if (!stat.isDirectory() && fs.existsSync(abs)) {
                var obj = namespace ? me.require(abs) : require(abs);
                recall && recall(obj, abs);
            }
        }
    })
}
/**
 * @desc 扫描文件夹，及文件夹下的文件
 * @param{string} cur 当前文件夹路径
 * @param{object} option.watch为选择监控, option.recall为监听响应函数，option.namespace选择导入命名空间
 * @return{array} 返回扫描文件夹下的所有子文件绝对路径
 */
me.scan = function(cur, option) {
    var res = [];
    if (option.watch) {
        me.watch(cur, option.recall, option.namespace);
    }
    var files = fs.readdirSync(cur);
    files.forEach(function(file) {
        var pathname = cur + '/' + file;
        var stat = fs.lstatSync(pathname);
        if (!stat.isDirectory()) {
            res.push(pathname);
            me.require(pathname);
        }
        else {
            var files = me.scan(pathname, option);
            res = res.concat(files);
        }
    });
    return res;
}

module.exports = me;
