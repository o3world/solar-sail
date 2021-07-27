function removeEmptyValues(obj) {
    return Object.fromEntries(Object.entries(obj).filter(([, value])=>{
        if (value === null) return false;
        if (value === undefined) return false;
        if (value === "") return false;
        return true;
    }));
}
function difference(arrA, arrB) {
    return arrA.filter((a)=>arrB.indexOf(a) < 0
    );
}
function parse(rawDotenv) {
    const env = {
    };
    for (const line of rawDotenv.split("\n")){
        if (!isVariableStart(line)) continue;
        const key = line.slice(0, line.indexOf("=")).trim();
        let value = line.slice(line.indexOf("=") + 1).trim();
        if (hasSingleQuotes(value)) {
            value = value.slice(1, -1);
        } else if (hasDoubleQuotes(value)) {
            value = value.slice(1, -1);
            value = expandNewlines(value);
        } else value = value.trim();
        env[key] = value;
    }
    return env;
}
function config(options = {
}) {
    const o = Object.assign({
        path: `.env`,
        export: false,
        safe: false,
        example: `.env.example`,
        allowEmptyValues: false,
        defaults: `.env.defaults`
    }, options);
    const conf = parseFile(o.path);
    if (o.safe) {
        const confExample = parseFile(o.example);
        assertSafe(conf, confExample, o.allowEmptyValues);
    }
    if (o.defaults) {
        const confDefaults = parseFile(o.defaults);
        for(const key in confDefaults){
            if (!(key in conf)) {
                conf[key] = confDefaults[key];
            }
        }
    }
    if (o.export) {
        for(const key in conf){
            if (Deno.env.get(key) !== undefined) continue;
            Deno.env.set(key, conf[key]);
        }
    }
    return conf;
}
function parseFile(filepath) {
    try {
        return parse(new TextDecoder("utf-8").decode(Deno.readFileSync(filepath)));
    } catch (e) {
        if (e instanceof Deno.errors.NotFound) return {
        };
        throw e;
    }
}
function isVariableStart(str) {
    return /^\s*[a-zA-Z_][a-zA-Z_0-9 ]*\s*=/.test(str);
}
function hasSingleQuotes(str) {
    return /^'([\s\S]*)'$/.test(str);
}
function hasDoubleQuotes(str) {
    return /^"([\s\S]*)"$/.test(str);
}
function expandNewlines(str) {
    return str.replaceAll("\\n", "\n");
}
function assertSafe(conf, confExample, allowEmptyValues) {
    const currentEnv = Deno.env.toObject();
    const confWithEnv = Object.assign({
    }, currentEnv, conf);
    const missing = difference(Object.keys(confExample), Object.keys(allowEmptyValues ? confWithEnv : removeEmptyValues(confWithEnv)));
    if (missing.length > 0) {
        const errorMessages = [
            `The following variables were defined in the example file but are not present in the environment:\n  ${missing.join(", ")}`,
            `Make sure to add them to your env file.`,
            !allowEmptyValues && `If you expect any of these variables to be empty, you can set the allowEmptyValues option to true.`, 
        ];
        throw new MissingEnvVarsError(errorMessages.filter(Boolean).join("\n\n"));
    }
}
class MissingEnvVarsError extends Error {
    constructor(message){
        super(message);
        this.name = "MissingEnvVarsError";
        Object.setPrototypeOf(this, new.target.prototype);
    }
}
const { Deno: Deno1  } = globalThis;
const noColor = typeof Deno1?.noColor === "boolean" ? Deno1.noColor : true;
let enabled = !noColor;
function code(open, close) {
    return {
        open: `\x1b[${open.join(";")}m`,
        close: `\x1b[${close}m`,
        regexp: new RegExp(`\\x1b\\[${close}m`, "g")
    };
}
function run(str, code1) {
    return enabled ? `${code1.open}${str.replace(code1.regexp, code1.open)}${code1.close}` : str;
}
function red(str) {
    return run(str, code([
        31
    ], 39));
}
function green(str) {
    return run(str, code([
        32
    ], 39));
}
function blue(str) {
    return run(str, code([
        34
    ], 39));
}
const ANSI_PATTERN = new RegExp([
    "[\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:[a-zA-Z\\d]*(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]*)*)?\\u0007)",
    "(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-ntqry=><~]))", 
].join("|"), "g");
var KeyType;
(function(KeyType1) {
    KeyType1["SOURCE"] = "SOURCE";
    KeyType1["DESTINATION"] = "DESTINATION";
})(KeyType || (KeyType = {
}));
const { HAPI_KEY_SOURCE , HAPI_KEY_DESTINATION  } = config({
    safe: true
});
class HubSpotClient {
    url = 'https://api.hubapi.com/';
    keySource = HAPI_KEY_SOURCE;
    keyDest = HAPI_KEY_DESTINATION;
    async request(path, key, options) {
        let keyParam = `?hapikey=${this.keySource}`;
        if (key == KeyType.DESTINATION) {
            keyParam = `?hapikey=${this.keyDest}`;
        }
        const endpoint = `${this.url}${path}${keyParam}`;
        const res = await fetch(endpoint, options);
        try {
            return await res.json();
        } catch (error) {
            return res;
        }
    }
    async syncPages(path) {
        const pages = await this.request(path, KeyType.SOURCE);
        for (const page of pages?.objects){
            delete page.id;
            this.request(path, KeyType.DESTINATION, {
                method: 'POST',
                body: JSON.stringify(page),
                headers: {
                    'content-type': 'application/json'
                }
            });
        }
    }
    async syncHubDb(path) {
        const tables = await this.request(path, KeyType.SOURCE);
        for (const table of tables?.objects){
            const payload = {
                name: table.name,
                label: table.label,
                columns: table.columns,
                createdAt: table.createdAt,
                publishedAt: table.publishedAt
            };
            console.log(blue(`Creating New HubDB table: ${table.name}`));
            const newTable = await this.request(path, KeyType.DESTINATION, {
                method: 'POST',
                body: JSON.stringify(payload),
                headers: {
                    'content-type': 'application/json'
                }
            });
            console.log(newTable);
            const sourceTableRows = await this.request(`hubdb/api/v2/tables/${table.id}/rows`, KeyType.SOURCE);
            for (const row of sourceTableRows?.objects){
                await this.request(`hubdb/api/v2/tables/${newTable.id}/rows`, KeyType.DESTINATION, {
                    method: 'POST',
                    body: JSON.stringify({
                        values: row.values
                    }),
                    headers: {
                        'content-type': 'application/json'
                    }
                });
            }
        }
    }
    async deleteBlogs() {
        const path = 'content/api/v2/blogs';
        const blogs = await this.request(path, KeyType.DESTINATION);
        for (const blog of blogs?.objects){
            console.log(blue(`Deleting ${blog.name}`));
            const res = await this.request(`${path}/${blog.id}`, KeyType.DESTINATION, {
                method: 'DELETE'
            });
            if (res.status == 204) {
                console.log(green(`Successfully deleted "${blog.name}" blog.`));
            }
        }
    }
    async syncBlogs() {
        const path = 'content/api/v2/blogs';
        console.log(blue('Getting List of Blogs'));
        const blogs = await this.request(path, KeyType.SOURCE);
        console.log(green(`Successfully fetched list of Blogs`));
        for (const blog of blogs?.objects){
            console.log(blue(`Syncing Blog named: ${blog.name}`));
            const res = await this.request(path, KeyType.DESTINATION, {
                method: 'POST',
                body: JSON.stringify(blog),
                headers: {
                    'content-type': 'application/json'
                }
            });
            if (res?.status == 'error') {
                console.log(red(res.message));
            } else {
                console.log(green(`Blog: ${res.name} created successfully at ${res.domain_when_published}.`));
            }
        }
    }
    async getParentBlog(parentName) {
        const destParentBlogs = await this.request('content/api/v2/blogs', KeyType.DESTINATION);
        for (const blog of destParentBlogs?.objects){
            if (blog.name == parentName) {
                return blog;
            }
        }
    }
    async syncBlogPosts(path) {
        await this.syncBlogs();
        console.log(blue('Getting List of Blog Posts'));
        const blogPosts = await this.request(path, KeyType.SOURCE);
        console.log(green(`Successfully fetched list of Blog Posts`));
        for (const blogPost of blogPosts?.objects){
            console.log(blue(`Syncing Blog post: ${blogPost.name}`));
            const parentBlog = await this.getParentBlog(blogPost.parent_blog.name);
            if (!parentBlog) continue;
            blogPost.content_group_id = parentBlog.id;
            const res = await this.request(path, KeyType.DESTINATION, {
                method: 'POST',
                body: JSON.stringify(blogPost),
                headers: {
                    'content-type': 'application/json'
                }
            });
            if (res?.status == 'error') {
                console.log(red(res.message));
            } else {
                console.log(green(`Blog Post: ${res.name} created successfully at ${res.url}.`));
            }
        }
    }
}
class DenoStdInternalError extends Error {
    constructor(message1){
        super(message1);
        this.name = "DenoStdInternalError";
    }
}
function assert(expr, msg = "") {
    if (!expr) {
        throw new DenoStdInternalError(msg);
    }
}
function get(obj, key) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
        return obj[key];
    }
}
function getForce(obj, key) {
    const v = get(obj, key);
    assert(v != null);
    return v;
}
function isNumber(x) {
    if (typeof x === "number") return true;
    if (/^0x[0-9a-f]+$/i.test(String(x))) return true;
    return /^[-+]?(?:\d+(?:\.\d*)?|\.\d+)(e[-+]?\d+)?$/.test(String(x));
}
function hasKey(obj, keys) {
    let o = obj;
    keys.slice(0, -1).forEach((key)=>{
        o = get(o, key) ?? {
        };
    });
    const key = keys[keys.length - 1];
    return key in o;
}
function parse1(args, { "--": doubleDash = false , alias ={
} , boolean: __boolean = false , default: defaults = {
} , stopEarly =false , string =[] , unknown =(i)=>i
  } = {
}) {
    const flags = {
        bools: {
        },
        strings: {
        },
        unknownFn: unknown,
        allBools: false
    };
    if (__boolean !== undefined) {
        if (typeof __boolean === "boolean") {
            flags.allBools = !!__boolean;
        } else {
            const booleanArgs = typeof __boolean === "string" ? [
                __boolean
            ] : __boolean;
            for (const key of booleanArgs.filter(Boolean)){
                flags.bools[key] = true;
            }
        }
    }
    const aliases = {
    };
    if (alias !== undefined) {
        for(const key in alias){
            const val = getForce(alias, key);
            if (typeof val === "string") {
                aliases[key] = [
                    val
                ];
            } else {
                aliases[key] = val;
            }
            for (const alias1 of getForce(aliases, key)){
                aliases[alias1] = [
                    key
                ].concat(aliases[key].filter((y)=>alias1 !== y
                ));
            }
        }
    }
    if (string !== undefined) {
        const stringArgs = typeof string === "string" ? [
            string
        ] : string;
        for (const key of stringArgs.filter(Boolean)){
            flags.strings[key] = true;
            const alias1 = get(aliases, key);
            if (alias1) {
                for (const al of alias1){
                    flags.strings[al] = true;
                }
            }
        }
    }
    const argv = {
        _: []
    };
    function argDefined(key, arg) {
        return flags.allBools && /^--[^=]+$/.test(arg) || get(flags.bools, key) || !!get(flags.strings, key) || !!get(aliases, key);
    }
    function setKey(obj, keys, value) {
        let o = obj;
        keys.slice(0, -1).forEach(function(key) {
            if (get(o, key) === undefined) {
                o[key] = {
                };
            }
            o = get(o, key);
        });
        const key = keys[keys.length - 1];
        if (get(o, key) === undefined || get(flags.bools, key) || typeof get(o, key) === "boolean") {
            o[key] = value;
        } else if (Array.isArray(get(o, key))) {
            o[key].push(value);
        } else {
            o[key] = [
                get(o, key),
                value
            ];
        }
    }
    function setArg(key, val, arg = undefined) {
        if (arg && flags.unknownFn && !argDefined(key, arg)) {
            if (flags.unknownFn(arg, key, val) === false) return;
        }
        const value = !get(flags.strings, key) && isNumber(val) ? Number(val) : val;
        setKey(argv, key.split("."), value);
        const alias1 = get(aliases, key);
        if (alias1) {
            for (const x of alias1){
                setKey(argv, x.split("."), value);
            }
        }
    }
    function aliasIsBoolean(key) {
        return getForce(aliases, key).some((x)=>typeof get(flags.bools, x) === "boolean"
        );
    }
    for (const key of Object.keys(flags.bools)){
        setArg(key, defaults[key] === undefined ? false : defaults[key]);
    }
    let notFlags = [];
    if (args.includes("--")) {
        notFlags = args.slice(args.indexOf("--") + 1);
        args = args.slice(0, args.indexOf("--"));
    }
    for(let i = 0; i < args.length; i++){
        const arg = args[i];
        if (/^--.+=/.test(arg)) {
            const m = arg.match(/^--([^=]+)=(.*)$/s);
            assert(m != null);
            const [, key1, value] = m;
            if (flags.bools[key1]) {
                const booleanValue = value !== "false";
                setArg(key1, booleanValue, arg);
            } else {
                setArg(key1, value, arg);
            }
        } else if (/^--no-.+/.test(arg)) {
            const m = arg.match(/^--no-(.+)/);
            assert(m != null);
            setArg(m[1], false, arg);
        } else if (/^--.+/.test(arg)) {
            const m = arg.match(/^--(.+)/);
            assert(m != null);
            const [, key1] = m;
            const next = args[i + 1];
            if (next !== undefined && !/^-/.test(next) && !get(flags.bools, key1) && !flags.allBools && (get(aliases, key1) ? !aliasIsBoolean(key1) : true)) {
                setArg(key1, next, arg);
                i++;
            } else if (/^(true|false)$/.test(next)) {
                setArg(key1, next === "true", arg);
                i++;
            } else {
                setArg(key1, get(flags.strings, key1) ? "" : true, arg);
            }
        } else if (/^-[^-]+/.test(arg)) {
            const letters = arg.slice(1, -1).split("");
            let broken = false;
            for(let j = 0; j < letters.length; j++){
                const next = arg.slice(j + 2);
                if (next === "-") {
                    setArg(letters[j], next, arg);
                    continue;
                }
                if (/[A-Za-z]/.test(letters[j]) && /=/.test(next)) {
                    setArg(letters[j], next.split(/=(.+)/)[1], arg);
                    broken = true;
                    break;
                }
                if (/[A-Za-z]/.test(letters[j]) && /-?\d+(\.\d*)?(e-?\d+)?$/.test(next)) {
                    setArg(letters[j], next, arg);
                    broken = true;
                    break;
                }
                if (letters[j + 1] && letters[j + 1].match(/\W/)) {
                    setArg(letters[j], arg.slice(j + 2), arg);
                    broken = true;
                    break;
                } else {
                    setArg(letters[j], get(flags.strings, letters[j]) ? "" : true, arg);
                }
            }
            const [key1] = arg.slice(-1);
            if (!broken && key1 !== "-") {
                if (args[i + 1] && !/^(-|--)[^-]/.test(args[i + 1]) && !get(flags.bools, key1) && (get(aliases, key1) ? !aliasIsBoolean(key1) : true)) {
                    setArg(key1, args[i + 1], arg);
                    i++;
                } else if (args[i + 1] && /^(true|false)$/.test(args[i + 1])) {
                    setArg(key1, args[i + 1] === "true", arg);
                    i++;
                } else {
                    setArg(key1, get(flags.strings, key1) ? "" : true, arg);
                }
            }
        } else {
            if (!flags.unknownFn || flags.unknownFn(arg) !== false) {
                argv._.push(flags.strings["_"] ?? !isNumber(arg) ? arg : Number(arg));
            }
            if (stopEarly) {
                argv._.push(...args.slice(i + 1));
                break;
            }
        }
    }
    for (const key1 of Object.keys(defaults)){
        if (!hasKey(argv, key1.split("."))) {
            setKey(argv, key1.split("."), defaults[key1]);
            if (aliases[key1]) {
                for (const x of aliases[key1]){
                    setKey(argv, x.split("."), defaults[key1]);
                }
            }
        }
    }
    if (doubleDash) {
        argv["--"] = [];
        for (const key2 of notFlags){
            argv["--"].push(key2);
        }
    } else {
        for (const key2 of notFlags){
            argv._.push(key2);
        }
    }
    return argv;
}
const { HAPI_KEY_SOURCE: HAPI_KEY_SOURCE1 , HAPI_KEY_DESTINATION: HAPI_KEY_DESTINATION1  } = config({
    safe: true
});
if (HAPI_KEY_DESTINATION1 && HAPI_KEY_SOURCE1) {
    const args = parse1(Deno.args);
    const client = new HubSpotClient();
    if (args?.pages == 'sync') {
        client.syncPages('content/api/v2/pages');
    }
    if (args?.hubdb == 'sync') {
        client.syncHubDb('hubdb/api/v2/tables');
    }
    if (args?.blogs == 'sync') {
        client.syncBlogPosts('content/api/v2/blog-posts');
    }
    if (args?.blogs == 'delete') {
        client.deleteBlogs();
    }
} else {
    console.error(red('A .env file with HAPI_KEY_DESTINATION and HAPI_KEY_SOURCE not found, please add it to your current directory.'));
}

