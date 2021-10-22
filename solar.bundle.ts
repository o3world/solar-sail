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
    if (o.defaults) {
        const confDefaults = parseFile(o.defaults);
        for(const key in confDefaults){
            if (!(key in conf)) {
                conf[key] = confDefaults[key];
            }
        }
    }
    if (o.safe) {
        const confExample = parseFile(o.example);
        assertSafe(conf, confExample, o.allowEmptyValues);
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
function run(str, code) {
    return enabled ? `${code.open}${str.replace(code.regexp, code.open)}${code.close}` : str;
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
function yellow(str) {
    return run(str, code([
        33
    ], 39));
}
function blue(str) {
    return run(str, code([
        34
    ], 39));
}
new RegExp([
    "[\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:[a-zA-Z\\d]*(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]*)*)?\\u0007)",
    "(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-ntqry=><~]))", 
].join("|"), "g");
var KeyType;
(function(KeyType) {
    KeyType["SOURCE"] = "SOURCE";
    KeyType["DESTINATION"] = "DESTINATION";
})(KeyType || (KeyType = {
}));
const { HAPI_KEY_SOURCE , HAPI_KEY_DESTINATION  } = config({
    safe: true
});
class HubSpotClient {
    url = 'https://api.hubapi.com/';
    keySource = HAPI_KEY_SOURCE;
    keyDest = HAPI_KEY_DESTINATION;
    getPageByIdPath(id) {
        return `content/api/v2/pages/${id}`;
    }
    async sleep(ms) {
        await new Promise((resolve)=>{
            setTimeout(resolve, ms);
        });
    }
    async request(path, key, options, queryStr) {
        await this.sleep(105);
        let keyParam = `?hapikey=${this.keySource}`;
        if (key == KeyType.DESTINATION) {
            keyParam = `?hapikey=${this.keyDest}`;
        }
        let endpoint = `${this.url}${path}${keyParam}`;
        if (queryStr) {
            endpoint += `${queryStr}`;
        }
        const res = await fetch(endpoint, options);
        try {
            const result = await res.json();
            return {
                status: res.status,
                ...result
            };
        } catch (error) {
            return res;
        }
    }
    async isForbidden() {
        try {
            const template = await this.request('content/api/v2/templates', KeyType.DESTINATION, undefined, '&limit=1');
            if (!template) {
                console.log(red('Couldn\'t reach destination api.'));
                return true;
            }
            if (template.total == 0) {
                console.log(yellow('No templatess to check againsts.'));
                return true;
            }
            const templateObject = template.objects[0];
            switch(templateObject.portal_id){
                case 6679661:
                case 20431515:
                    return true;
            }
            return false;
        } catch (error) {
            console.log(red(`${error}`));
            return true;
        }
    }
    async getDestParent(translatedFromId, pageId, listPagesPath) {
        const sourceParent = await this.request(this.getPageByIdPath(translatedFromId), KeyType.SOURCE, undefined, '&limit=1');
        if (!sourceParent.name) {
            console.error(red(`Error finding parent content on source environment with ID ${pageId}.`));
            return null;
        }
        const sourceParentLang = sourceParent.language ?? 'en-us';
        const destParents = await this.request(listPagesPath, KeyType.DESTINATION, undefined, `&limit=1&name__icontains=${encodeURIComponent(sourceParent.name)}&language__in=${sourceParentLang}`);
        if (typeof destParents.objects !== 'undefined' && destParents.objects.length) {
            return destParents.objects[0];
        }
        return null;
    }
    async syncPages(path) {
        const pages = await this.request(path, KeyType.SOURCE, undefined, '&limit=20000');
        const orphanedTranslations = [];
        for (const page of pages?.objects){
            if (page.translated_from_id) {
                const destParent = await this.getDestParent(page.translated_from_id, page.id, path);
                if (destParent) {
                    page.translated_from_id = destParent.id;
                } else {
                    orphanedTranslations.push(page);
                    continue;
                }
            }
            delete page.id;
            await this.request(path, KeyType.DESTINATION, {
                method: 'POST',
                body: JSON.stringify(page),
                headers: {
                    'content-type': 'application/json'
                }
            });
        }
        for (const page1 of orphanedTranslations){
            const destParent = await this.getDestParent(page1.translated_from_id, page1.id, path);
            if (destParent) {
                page1.translated_from_id = destParent.id;
                delete page1.id;
                await this.request(path, KeyType.DESTINATION, {
                    method: 'POST',
                    body: JSON.stringify(page1),
                    headers: {
                        'content-type': 'application/json'
                    }
                });
            } else {
                console.error(red(`Unable to create page with live ID: ${page1.id}`));
            }
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
            if (newTable.status == '200') {
                console.log(green(`Table: ${table.name} was created successfully`));
            }
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
        const mainBlogs = blogs.objects.filter((blog)=>blog.translated_from_id == null ? true : false
        );
        for (const mainBlog of mainBlogs){
            const payload = {
                name: mainBlog.name,
                category_id: mainBlog.category_id,
                created: mainBlog.created,
                updated: mainBlog.updated,
                item_template_path: mainBlog.item_template_path,
                public_title: mainBlog.public_title,
                html_title: mainBlog.html_title,
                slug: mainBlog.slug,
                description: mainBlog.description,
                language: mainBlog.language
            };
            const res = await this.request(path, KeyType.DESTINATION, {
                method: 'POST',
                body: JSON.stringify(payload),
                headers: {
                    'content-type': 'application/json'
                }
            });
            if (res?.status == 'error') {
                return console.log(red(res.message));
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
    async syncTemplates(path) {
        const sourceTemplates = await this.request(path, KeyType.SOURCE);
        const destinationTemplates = await this.request(path, KeyType.DESTINATION);
        let templatesToSync = [];
        for (const sourceTemplate of sourceTemplates?.objects){
            for (const destinationTemplate of destinationTemplates?.objects){
                if (sourceTemplates.id == destinationTemplates.id) continue;
                templatesToSync.push(sourceTemplate);
            }
        }
        for (const template of templatesToSync){
            const res = await this.request(path, KeyType.DESTINATION, {
                method: 'POST',
                body: JSON.stringify(template),
                headers: {
                    'content-type': 'application/json'
                }
            });
            if (res?.status == 'error') {
                console.log(red(res.message));
            } else {
                console.log(green(`Template ${res.path} created successfully.`));
            }
        }
    }
    async syncBlogAuthors() {
        const sourceAuthors = await this.request('blogs/v3/blog-authors', KeyType.SOURCE);
        for (const author of sourceAuthors.objects){
            const res = await this.request('blogs/v3/blog-authors', KeyType.DESTINATION, {
                method: 'POST',
                body: JSON.stringify(author),
                headers: {
                    'content-type': 'application/json'
                }
            });
            if (res?.status == 'error') {
                console.log(red(res.message));
            } else {
                console.log(green(`Author: ${res.name} created successfully at ${res.url}.`));
            }
        }
    }
    async syncBlogPosts(path) {
        await this.syncBlogAuthors();
        await this.syncBlogs();
        const destinationAuthors = await this.request('blogs/v3/blog-authors', KeyType.DESTINATION);
        const sungardAsAuthorId = destinationAuthors.objects.find((author)=>author.displayName == 'Sungard AS'
        ).id;
        console.log(blue('Getting List of Blog Posts'));
        const blogPosts = await this.request(path, KeyType.SOURCE, undefined, '&limit=200');
        console.log(green(`Successfully fetched list of Blog Posts`));
        for (const blogPost of blogPosts?.objects){
            const parentBlog = await this.getParentBlog(blogPost.parent_blog.name);
            if (!parentBlog) continue;
            blogPost.content_group_id = parentBlog.id;
            blogPost.blog_author_id = sungardAsAuthorId;
            if (blogPost?.translated_from_id) continue;
            console.log(blue(`Syncing Blog post: ${blogPost.name}`));
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
    constructor(message){
        super(message);
        this.name = "DenoStdInternalError";
    }
}
function assert(expr, msg = "") {
    if (!expr) {
        throw new DenoStdInternalError(msg);
    }
}
const { hasOwn  } = Object;
function get(obj, key) {
    if (hasOwn(obj, key)) {
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
            const alias = get(aliases, key);
            if (alias) {
                for (const al of alias){
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
        const alias = get(aliases, key);
        if (alias) {
            for (const x of alias){
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
            const [, key, value] = m;
            if (flags.bools[key]) {
                const booleanValue = value !== "false";
                setArg(key, booleanValue, arg);
            } else {
                setArg(key, value, arg);
            }
        } else if (/^--no-.+/.test(arg)) {
            const m = arg.match(/^--no-(.+)/);
            assert(m != null);
            setArg(m[1], false, arg);
        } else if (/^--.+/.test(arg)) {
            const m = arg.match(/^--(.+)/);
            assert(m != null);
            const [, key] = m;
            const next = args[i + 1];
            if (next !== undefined && !/^-/.test(next) && !get(flags.bools, key) && !flags.allBools && (get(aliases, key) ? !aliasIsBoolean(key) : true)) {
                setArg(key, next, arg);
                i++;
            } else if (/^(true|false)$/.test(next)) {
                setArg(key, next === "true", arg);
                i++;
            } else {
                setArg(key, get(flags.strings, key) ? "" : true, arg);
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
            const [key] = arg.slice(-1);
            if (!broken && key !== "-") {
                if (args[i + 1] && !/^(-|--)[^-]/.test(args[i + 1]) && !get(flags.bools, key) && (get(aliases, key) ? !aliasIsBoolean(key) : true)) {
                    setArg(key, args[i + 1], arg);
                    i++;
                } else if (args[i + 1] && /^(true|false)$/.test(args[i + 1])) {
                    setArg(key, args[i + 1] === "true", arg);
                    i++;
                } else {
                    setArg(key, get(flags.strings, key) ? "" : true, arg);
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
        for (const key of notFlags){
            argv["--"].push(key);
        }
    } else {
        for (const key of notFlags){
            argv._.push(key);
        }
    }
    return argv;
}
async function solarSailCli() {
    const args = parse1(Deno.args);
    const client = new HubSpotClient();
    const isForbidden = await client.isForbidden();
    if (isForbidden) {
        console.log(red('Your DESTINATION api key is pointing to the wrong enviroment. Make sure its your own sandbox API key'));
        return;
    }
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
    if (args?.blogs == 'only') {
        client.syncBlogs();
    }
    if (args?.templates == 'sync') {
        client.syncTemplates('content/api/v2/templates');
    }
    if (args?.all == 'sync') {
        client.syncTemplates('content/api/v2/templates');
        client.syncPages('content/api/v2/pages');
        client.syncHubDb('hubdb/api/v2/tables');
        client.syncBlogPosts('content/api/v2/blog-posts');
    }
}
const { HAPI_KEY_SOURCE: HAPI_KEY_SOURCE1 , HAPI_KEY_DESTINATION: HAPI_KEY_DESTINATION1  } = config({
    safe: true
});
if (HAPI_KEY_DESTINATION1 && HAPI_KEY_SOURCE1) {
    solarSailCli();
} else {
    console.error(red('A .env file with HAPI_KEY_DESTINATION and HAPI_KEY_SOURCE not found, please add it to your current directory.'));
}

