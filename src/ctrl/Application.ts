import {AbstractComponent, AbstractComponentConstructor} from '../component/AbstractComponent';
import {AbstractSence, AbstractSenceConstructor} from '../decorators/AbstractSence';
import {Container,
        DisplayObject,
        Game} from '../abstract/index';
import {Directive} from '../decorators/directive';
import Dom from '../util/Dom';
import Is from '../util/Is';
import {parseDirective} from '../util/LayaParse';
import {createStore, combineReducers} from 'redux';
import * as Redux from 'redux/index.d.ts';

declare var module;

function createPhaserTree(domTree: Element): ComponentItem {
    let res:        ComponentItem  = Object.create(null);
    let attrs:      NamedNodeMap   = domTree.attributes;
    let normals:    Array<Attr>    = Array.prototype.filter.call(attrs, (v) => !/^l-/.test(v.name));
    let children:   Array<Element> = Dom.getChildren(domTree);
    let phaserCons: string         = domTree.nodeName.replace(/^\w/, (a)    => a.toUpperCase());
    let directives: Array<string>  = Array.prototype.filter.call(attrs, (v) => /^l-/.test(v.name));

    let handler: Object = res[phaserCons]     = Object.create(null);

    handler['normals']    = normals;
    handler['children']   = children.map(v => createPhaserTree(v));
    handler['directives'] = directives;

    return res;
}

/**
 * @prop data 组件中属于 data 一类属性的数组，data 属性只在组件内部可以访问到。
 * @prop prop 组件中属于 prop 一类属性的数组，prop 属性须由父组件传入。
 * @prop data 组件中属于 getter 一类属性的数组， getter 属性由 @getter 从应用程序状态树取值注入。
 */
declare interface DataPropGetter {
    data:   Set<string>;
    prop:   Set<string>;
    getter: Set<string>;
}

declare interface DataGetter {
    data:   Array<string>;
    getter: Array<string>;
}

export interface ComponentItem {
    normals:          Array<Attr>;
    children:         Array<ComponentItem>;
    directives:       Array<Attr>;
}

/**
 * @prop objectFactory 
 */
class Application {
    store:             Redux.Store<any>;
    private game:              Game;
    private sence:             Map<string, any>;
    private curSence:          string;
    private components:        Map<string, AbstractComponentConstructor>;
    private directives:        Map<string, Directive>;
    private dependencies:      Map<string, Map<string, Array<Function>>>;
    private senceTreeMap:      Map<string, ComponentItem>;
    private componentTreeMap:  Map<string, ComponentItem>;
    private componentDataMap:  Map<string, Map<number, any>>;
    private displayObjectCons: Map<string, any>;
    private cptDataPropGetter: Map<string, DataPropGetter>;

    constructor() {
        this.sence             = new Map<string, any>();
        this.components        = new Map<string, AbstractComponentConstructor>();
        this.directives        = new Map<string, Directive>();
        this.dependencies      = new Map<string, Map<string, Array<Function>>>();
        this.senceTreeMap      = new Map<string, ComponentItem>();
        this.componentTreeMap  = new Map<string, ComponentItem>();
        this.componentDataMap  = new Map<string, Map<number, any>>();
        this.displayObjectCons = new Map<string, any>();
        this.cptDataPropGetter = new Map<string, DataPropGetter>();
    }

    registerComponent(creator: AbstractComponentConstructor, tree: Document): void {
        let name: string = creator.toString().match(/function\s*(\w+)/)[1];
        // if (Is.isPresent(this.components.get(name))) {
        //     console.error('components ' + name + '已经注册过');
        //     return;
        // }
        let phaserTree: ComponentItem = createPhaserTree(<Element>tree.firstChild);
        this.componentTreeMap.set(name, phaserTree);
        this.components.set(name, creator);
        this.componentDataMap.set(name, new Map<number, any>());
    }

    registerSence(creator: AbstractSenceConstructor, tree: Document) {
        let name: string = creator.toString().match(/function\s*(\w+)/)[1];
        if (Is.isPresent(this.sence.get(name))) {
            console.error('sences ' + name + '已经注册过');
            return;
        }
        let phaserTree = createPhaserTree(<Element>tree.firstChild);

        this.senceTreeMap.set(name, phaserTree);
        let ret     = new creator();
        let preload = ret.preload;
        let hook    = this.buildSence.bind(this);
        ret.preload = function () {
            hook.apply(null, [name, ret]);
            preload.apply(ret);
        };
        this.sence.set(name, ret);
        let map = new Map<number, any>();
        map.set(<any>ret, Object.create(null));
        this.componentDataMap.set(name, map);
        this.initDependencies(name, phaserTree['Sence']);
    }

    /**
     *  构建场景
     */
    buildSence(senceName: string, sence: AbstractSence, viewModel: any = undefined, ignore = []): void {
        let senceTree = this.senceTreeMap.get(senceName);
        let keys      = Object.keys(senceTree);
        let obj       = senceTree[keys[0]];
        this.game.setWorld(sence.getWorld());
        if (keys.length > 1 || keys[0] !== 'Sence') {
            console.error('sence的模板必须包含在单个 <sence></sence> 标签中。 --->', name);
        }
        let remainingVm = this.setComponentViewModel(senceName, <any>sence, viewModel, ignore);
        obj.children.forEach((value) => {
            let name    = Object.keys(value)[0];
            let creator = this.components.get(name);
            if (Is.isAbsent(creator)) {
                this.buildDisplayObject(<any>sence, senceName, name, value[name], this.game.getWorld());
            } else {
                this.buildComponent(<any>sence, senceName, name, value[name], this.game.getWorld(), remainingVm, ignore);
            }
        });
    }

    initDependencies(cpt: string, ...item: Array<ComponentItem>) {
        let map = new Map<string, Array<Function>>();
        let itemHandler = function handler(item, map) {
            item.directives.forEach(({value}) => {map.set(value, []); });
            if (item.children.length > 0) {
                item.children.forEach((v) => {
                    let key = Object.keys(v)[0];
                    handler(v[key], map);
                });
            }
        };
        item.forEach(v => {itemHandler(v, map); });
        this.dependencies.set(cpt, map);
    }

    setComponentViewModel(name: string, cpt: AbstractComponent, vm: any = undefined, ignore: Array<string> = []) {
        if (Is.isPresent(vm) && ignore.indexOf(name) < 0) {
            let namedMap = vm.get(name);
            let next     = namedMap.keys().next();
            let oneOf    = namedMap.get(next.value);
            if (Is.isAbsent(oneOf)) {
                console.error('viewModel 数据缺失!', name);
            }
            this.componentDataMap.get(name).set(cpt.getId(), namedMap.get(next.value));
            namedMap.delete(next.value);
        } else {
            let all  = this.cptDataPropGetter.get(name);
            let that = this;
            this.componentDataMap.get(name).set(cpt.getId(), Object.create(null));
            if (Is.isPresent(all)) {
                for (let key in all) {
                    all[key].forEach((property, index, array) => {
                        that.setDataVm(name, cpt, property, cpt[property]); // 设置 viewModel 的默认值
                        if (key === 'data') {
                            Object.defineProperty(cpt, property, {
                                get () {
                                    return that.getDataVm(name, cpt)[property];
                                },
                                set (value) {
                                    that.setDataVm(name, cpt, property, value);
                                    that.getDependencies(name, property).forEach(v => v.apply(null, [cpt, value]));
                                }
                            });
                        } else {
                            Object.defineProperty(cpt, property, {
                                get () {
                                    return that.getDataVm(name, cpt)[property];
                                },
                                set (value) {
                                    debugger;
                                    console.warn('getter 和 prop 属性不能赋值。');
                                }
                            });
                        }
                    });
                }
            }
        }
        return vm;
    }

    /**
     * @param own 组件的上级， 可能是另一个组件或者是一个场景对象
     * @param owenName 上层组件的名称
     * @param name 组件的名称，大小写敏感，其实就是组件类的类名
     * @param ele 以组件名为名的标签上的解析结果，比如： <spin attr="attr" />， attr 属性就在 ele.normals 里面
     *            而组件的实现中标签的解析结果， 需从 componentTreeMap 中取出。
     * @param container 父级容器
     * @param viewModel 可选， 用于使用现有数据重新构建 component
     * @param ignore 可选， hmr 时更新的 component 不能用 vm 重建
     */
    buildComponent(own: AbstractComponent, ownName: string, name: string, ele: ComponentItem, container: Container<DisplayObject<any>>, viewModel: any = undefined, ignore: Array<string> = []): AbstractComponent {
        if (ele.normals.length + ele.directives.length !== this.cptDataPropGetter.get(name).prop.size) {
            console.warn('组件 prop 属性，与父组件传入不符。 检查 @prop 标记， ' + name);
        }
        let tree  = this.componentTreeMap.get(name);
        let cons  = this.components.get(name);
        let self  = new cons();
        let group = Object.keys(tree)[0];
        if (group !== 'Container') {
            console.error('组件模板必须以Group为根元素');
        }

        this.initDependencies(name, tree[group], ele);
        // 设置 component 的 viewModel，在此之后才能 buildDiplayObject
        let remainingVm = this.setComponentViewModel(name, self, viewModel, ignore);
        // 设置 component prop 属性的默认值
        ele.normals.concat(ele.directives).forEach(({name: attrName, value: attrVal}) => {
            let argument = parseDirective(attrName);
            if (Is.isAbsent(argument)) {
                this.componentDataMap.get(name).get(self.getId())[attrName] = own[attrVal];
            } else {
                this.componentDataMap.get(name).get(self.getId())[argument.argument] = own[attrVal];
            }
        });
        let subContainer: any = this.buildDisplayObject(self, name, group, tree[group], container);
        self.setRootContainer(subContainer);
        // todo delete
        // ele.normals.forEach(({name: attrName}) => { // 组件上的普通属性，直接赋值
        //     self[attrName] = this.getDataVm(name, self)[attrName];
        // });
        ele.directives.forEach(({name: attrName, value}) => { // 绑定组件标签上的指令
            let {name: directiveName, argument: directiveArg} = parseDirective(attrName);
            /**
             * <container bind-visible="visible">
             *     <scroller l-bind-test="test"/>
             *     <image key="loading" l-bind-x="x" l-bind-y="y"/>
             * </container>
             *  像这样组件包含另一个组件， ele.directives 是 <scroller> 上的指令， 这一部分指令是bind传入的应该是 ownName
             */
            this.getDirective(directiveName).bind(ownName, own, self, directiveArg, value, this);
        });
        ele.children.forEach((value, index, array) => {
            let childName = Object.keys(value)[0];
            let cons = this.components.get(name);
            if (Is.isAbsent(cons)) {
                this.buildDisplayObject(self, name, childName, value[childName], subContainer);
            } else {
                this.buildComponent(self, name, childName, value[childName], subContainer, remainingVm, ignore);
            }
        });
        return self;
    }

    /**
     * @param own 拥有 DisplayObject 的上层组件
     * @param ownName 上层组件名称
     * @param name DisplayObject 名称
     * @param obj 当前 displayObject 标签解析结果
     * @param container 在引擎层面包含 displayObject 的容器
     */
    buildDisplayObject(own: AbstractComponent, ownName: string, name: string, obj: ComponentItem, container: Container<DisplayObject<any>>): DisplayObject<any> {
        let viewModel = this.getDataVm(ownName, own);
        let creator   = this.displayObjectCons.get(name);
        let diso      = new creator(this.game, obj.normals, obj.directives, viewModel, ownName);
        obj.directives.forEach(({name: attrName, value}) => {
            let {name: directiveName, argument: directiveArg} = parseDirective(attrName);
            this.getDirective(directiveName).bind(ownName, own, diso, directiveArg, value, this);
        });
        if (name === 'Container') {
            obj.children.forEach(v => {
                let name = Object.keys(v)[0];
                let cons = this.components.get(name);
                if (Is.isAbsent(cons)) {
                    this.buildDisplayObject(own, ownName, name, v[name], diso);
                } else {
                    this.buildComponent(own, ownName, name, v[name], diso);
                }
            });
        }
        container.add(diso);
        return diso;
    }

    getValue(cpt: string, path: string): any {
        return 'un do';
    }

    addDependencies(cpt: string, property: string, fn: Function): void {
        this.dependencies.get(cpt).get(property).push(fn);
    }

    getDependencies(cpt: string, prop: string): Array<Function> {
        return this.dependencies.get(cpt).get(prop);
    }

    setupDirective(directive: Directive): void {
        this.directives.set(directive.name, directive);
    }

    getDirective(key: string): Directive {
        return this.directives.get(key);
    }

    /**
     *  返回相应 component 的所有响应属性，包括 data prop getter
     */
    getDataVm(name: string, cpt: AbstractComponent): any {
        return this.componentDataMap.get(name).get(cpt.getId());
    }

    setDataVm(name: string, cpt: AbstractComponent, prop: string, value: any): void {
        this.componentDataMap.get(name).get(cpt.getId())[prop] = value;
    }

    getCurSence(): string {
        return this.curSence;
    }

    /**
     * 为组件注册添加属于 data 一类的属性
     * @cptName 组件名
     * @proName 属性名
     * @type 类型  data prop 或 getter
     */
    addDataPropertyForComponent(cptName: string, proName: string, type: string): void {
        if (Is.isAbsent(this.cptDataPropGetter.get(cptName))) {
            this.cptDataPropGetter.set(cptName, {data: new Set<string>(), prop: new Set<string>(), getter: new Set<string>()});
        }
        this.cptDataPropGetter.get(cptName)[type].add(proName);
    }

    boot (game: Game, state: string): void {
        let g = this.game = game;
        this.sence.forEach((value, key, map) => {g.registerSence(key, value); });
        this.curSence = state;
        g.senceJump(state);
    }

    senceJump(state: string, clearWorld: boolean, clearCache: boolean): void {
        this.game.senceJump(state, clearWorld, clearCache);
        this.curSence = state;
    }

    init(args: Array<AbstractComponentConstructor | AbstractSenceConstructor>): void {
        args.forEach((value) => new value());
    }

    setupDisplayObject(creates: any) {
        for (let name in creates) {
            this.displayObjectCons.set(name, creates[name]);
        }
    }

    initRedux(reducers: Redux.ReducersMapObject) {
        debugger;
        let all = combineReducers(reducers);
        this.store = createStore(all, undefined,
          window['devToolsExtension'] && window['devToolsExtension']());
    }

    /**
     * 将 name 所指定的组件注册的信息全部清除
     */
    clearCptAllData(name: string) {
        this.components.delete(name);
        this.dependencies.delete(name);
        this.componentTreeMap.delete(name);
        this.cptDataPropGetter.delete(name);
        let keys = this.componentDataMap.get(name).keys();
        let next;
        while (next = keys.next(), !next.done) {
            next.value.destroy();
        }
        this.componentDataMap.delete(name);
    }
}

export default Application;
export var app = new Application();