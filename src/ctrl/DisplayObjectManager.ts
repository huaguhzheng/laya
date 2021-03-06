import {LayaContainer} from '../abstract/LayaInterface';
import {AbstractComponent} from '../abstract/AbstractComponent';
import {AbstractSence} from '../abstract/AbstractSence';
import {ComponentNode} from './ComponentManager';
import ComponentManager from './ComponentManager';
import DirectiveManager from './DirectiveManager';
import Is from '../util/Is';
import postProcesser from '../post-processer';
import SupportObjectManager from './SupportObjectManager';
import {AbstractDisplayObject} from '../abstract/AbstractDisplay';
import {AbstractDisplayObjectConstructor} from '../abstract/AbstractDisplay';
import {AbstractSupportObject} from '../abstract/AbstractSupport';
import ObjectManager from './ObjectManager';

function preHook(calcValue, node, own, argument) {
    argument = argument.replace(/[A-Z]/g, (a) => {
        return '-' + a.toLowerCase();
    });
    if (calcValue === undefined) {
        console.warn(own.constructor['$$name'] + ' 组件 ', node.name + ' 标签, ' + argument + ' 属性计算结果为 undefined，检查标签中属性值是否拼写错误.');
    }
    if (typeof calcValue === 'function') {
        return calcValue.bind(own);
    }
    return calcValue;
}

export function collectAttributes(node: ComponentNode, own: AbstractComponent | AbstractSence, requireAttrs: Array<string>, optionalAttrs: Array<string>): any {
    let setters  = Object.create(null);
    let require  = Object.create(null);
    let optional = Object.create(null);
    node.normals.forEach(({name: attrName, value: attrVal}) => {
        let parsedName = attrName.replace(/\-([a-z])/g, (a: string, b: string) => {
                    return b.toUpperCase();
        });
        let calcValue = preHook(attrVal(own), node, own, parsedName); // 表达式计算结果
        if (requireAttrs.indexOf(parsedName) >= 0) {
            require[parsedName] = calcValue;
        } else if (optionalAttrs.indexOf(parsedName) >= 0) {
            optional[parsedName] = calcValue;
        } else {
            setters[parsedName] = calcValue;
        }
    });
    node.directives.forEach(({argument, value}) => {
        let calcValue = preHook(value(own), node, own, argument);
        if (requireAttrs.indexOf(argument) >= 0) {
            require[argument] = calcValue;
        } else if (optionalAttrs.indexOf(argument) >= 0) {
            optional[argument] = calcValue;
        } else if (argument.length > 0) {
            setters[argument] = calcValue;
        }
    });
    if (Object.keys(require).length < requireAttrs.length) {
        throw new Error(node.name + ' 标签, 缺少必须的属性, 必须属性有: ' + requireAttrs);
    }
    return {
        require,
        optional,
        setters
    };
}

/**
 *  @para own 拥有 DisplayObject 的上级组件
 *  @para name DisplayObject 名称
 *  @para node 标签解析结果
 *  @para container 在引擎层面包含 displayObject 的容器
 */
export default class DisplayObjectManager {
    private static registers: Map<string, AbstractDisplayObjectConstructor> = new Map<string, AbstractDisplayObjectConstructor>();

    /**
     *  构造DisplayObject时,必须传入构造函数的参数
     */
    private static requireAttrs: Map<string, Array<string>> = new Map<string, Array<string>>();
    /**
     *  构造DisplayObject时, 可选的参数
     */
    private static optionalAttrs: Map<string, Array<string>> = new Map<string, Array<string>>();

    static buildDisplayObject(own: AbstractComponent | AbstractSence,
                              node: ComponentNode, container: LayaContainer, id: number = -1): AbstractDisplayObject<any> {
        if (node.check.some(v => !v(own))) {
            return;
        }
        let game = own.getLayaGame();
        if (container === undefined) {
            container = own.getRootContainer();
        }
        let name   = node.name;
        let registe = DisplayObjectManager.registers.get(name);
        if (Is.isAbsent(registe)) {
            console.error(name + '对象未注册');
            return;
        }
        let {require, optional, setters} = collectAttributes(node, own, registe.$$require, registe.$$optional);
        let build: AbstractDisplayObject<any> = new registe(game, require, optional, id);
        ObjectManager.setObject(build.getId(), build);
        node.directives.forEach(({name, argument, value, triggers}) => {
             DirectiveManager.getDirective(name).bind(own, build, argument, value, triggers);
        });
        for (let attr in setters) { // 处理标签中的设置属性
            build[attr] = setters[attr];
        }
        let postFunc = postProcesser[name]; // 特别处理
        if (Is.isPresent(postFunc) && typeof postFunc === 'function') {
            postFunc(build, own, node, game, container);
        } else {
            let len = build['$$repeatCount'] || 1;
            for (let i = 0; i < len; i++) {
                if (build['$$repeatCount'] && build['$$repeatName']) {
                    (<AbstractComponent>own).setRepeatIndex(build['$$repeatName'], i);
                }
                node.children.forEach(v => {
                    if (SupportObjectManager.hasSupport(v.name)) {
                        SupportObjectManager.buildSupportObject(own, v, game, build);
                    } else if (ComponentManager.hasComponent(v.name)) {
                        console.error('只有 container 和 shadow 标签能包含子组件! find in' + v.name);
                    } else if (DisplayObjectManager.hasDisplay(v.name)) {
                        console.error('display object 一类的标签只能包含 support 标签, find in ' + v.name);
                    }
                });
            }
            (<any>container).addChildren(build.getId());
            container.add(build);
        }
        return build;
    }

    static registerDisplayObject(newFunc: AbstractDisplayObjectConstructor) {
        let name = newFunc['$$name'];
        DisplayObjectManager.registers.set(name, newFunc);
        DisplayObjectManager.requireAttrs.set(name, []);
        DisplayObjectManager.optionalAttrs.set(name, []);
    }

    static getLayaObjectImpl(name: string): any {
        return DisplayObjectManager.registers.get(name);
    }

    static addToRequireAttrs(name: string, attr: string): void {
        DisplayObjectManager.requireAttrs.get(name).push(attr);
    }

    static addToOptionalAttrs(name: string, attr: string): void {
        DisplayObjectManager.optionalAttrs.get(name).push(attr);
    }

    static hasDisplay(name: string): boolean {
        return DisplayObjectManager.registers.has(name);
    }

    static getInstance(id: number): AbstractDisplayObject<any> {
        return ObjectManager.getObject<AbstractDisplayObject<any>>(id);
    }

    static deleteDisplay(id: number): void {
        let instance = ObjectManager.getObject<AbstractDisplayObject<any>>(id);
        if (Is.isAbsent(instance)) {
            return;
        }
        instance.destroy();
        instance.getChildren().forEach(id => {
            let child = ObjectManager.getObject(id);
            if (child instanceof AbstractDisplayObject) {
                DisplayObjectManager.deleteDisplay(id);
            } else if (child instanceof AbstractComponent) {
                ComponentManager.deleteComponent(id);
            } else if (child instanceof AbstractSupportObject) {
                SupportObjectManager.deleteSupportObject(id);
            }
        });
        ObjectManager.deleteObject(id);
    }
}

window['_DisplayObjectManager'] = DisplayObjectManager;
