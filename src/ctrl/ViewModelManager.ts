import {AbstractComponent} from '../abstract/AbstractComponent';
import {AbstractSence} from '../abstract/AbstractSence';
import StateManager from './StateManager';
import equal from '../util/DeepEqual';
import objectUtil from '../util/Object';
import laya from './Laya';
import {Getter} from './DirectiveManager';
import Is from '../util/Is';

export interface ViewModel {
    value: any;
    dependences: Array<Function>;
}

export default class ViewModelManager {
    private static viewModel: Map<number, Map<string, ViewModel>> = new Map<number, Map<string, ViewModel>>();

    /**
     * @param id 组件id
     * @param name 组件类的属性名称
     * @param dependence 依赖, name属性改变后,要执行的回调函数
     */
    static addDependences(id: number, name: string, dependence: (val) => any) {
        ViewModelManager.viewModel.get(id).get(name).dependences.push(dependence);
    }

    /**
     * 初始化组件的viewModel, 设置属性和属性的默认值, 初始化依赖数组
     * @param id 组件id
     * @param name 属性名称
     * @param defaultValue 默认值
     */
    static addViewModel(id: number, name: string, defaultValue: any) {
        let viewModel = {
            value: defaultValue,
            dependences: []
        };
        ViewModelManager.viewModel.get(id).set(name, viewModel);
    }

    /**
     *  为sence 对象初始化viewModel. 设置响应属性和属性默认值, 初始化依赖数组
     *  @para sence sence对象
     *  @para activeProperties 该类 sence 对象的所有响应属性
     */
    static initSenceViewModel(sence: AbstractSence): void {
        let id  = sence.getId();
        let map = new Map<string, ViewModel>();
        ViewModelManager.viewModel.set(id, map);
        let cons: any = sence.constructor;
        if (Is.isPresent(cons.$$data)) {
            cons.$$data.forEach(v => {
                ViewModelManager.addViewModel(id, v, sence[v]);
                ViewModelManager.defineData(sence, v, map.get(v));
            });
        }
        if (Is.isPresent(cons.$$getter)) {
            cons.$$getter.forEach(v => {
                ViewModelManager.addViewModel(id, v.name, 'getter');
                StateManager.addToGetters(v, id);
                ViewModelManager.defineGetter(sence, v);
            });
        }
    }

    static defineData(obj: AbstractComponent | AbstractSence, propertyName: string, viewModel: ViewModel) {
         delete obj[propertyName];
         Object.defineProperty(obj, propertyName, {
            get() {
                return viewModel.value;
            },
            set(newValue) {
                if (equal(viewModel.value, newValue)) {
                    return;
                }
                viewModel.value = newValue;
                viewModel.dependences.forEach(v => v.apply(null, [newValue]));
            }
        });
    }

    static defineGetter(obj: AbstractComponent | AbstractSence, getter: Getter) {
        delete obj[getter.name];
        Object.defineProperty(obj, getter.name, {
            get() {
                return objectUtil.deepGet(laya.getState(), getter.path);
            },
            set (value) {
                console.warn('getter属性不能赋值。');
            }
        });
    }

    /**
     *  为 component 对象初始化viewModel. 设置响应属性和属性默认值, 初始化依赖数组
     *  @para component component
     *  @para activeProperties 该类 component 对象的所有响应属性
     */
    static initComponentViewModel(component: AbstractComponent): void {
        let id = component.getId();
        let map = new Map<string, ViewModel>();
        let cons: any = component.constructor;
        ViewModelManager.viewModel.set(id, map);
        if (Is.isPresent(cons.$$data)) {
            cons.$$data.forEach(v => {
                ViewModelManager.addViewModel(id, v, component[v]);
                ViewModelManager.defineData(component, v, map.get(v));
            });
        }
        if (Is.isPresent(cons.$$getter)) {
            cons.$$getter.forEach(v => {
                ViewModelManager.addViewModel(id, v.name, 'getter');
                StateManager.addToGetters(v, id);
                ViewModelManager.defineGetter(component, v);
            });
        }
        if (Is.isPresent(cons.$$prop)) {
            cons.$$prop.forEach(v => {
                ViewModelManager.addViewModel(id, v, component[v]);
                ViewModelManager.defineData(component, v, map.get(v));
            });
        }
    }

    /**
     *  当某个组件的响应式属性需要改变时, 调用这个方法. 改变属性, 并执行相应的依赖.
     *  @para component 属性值改变了的组件实例
     *  @para property 改变的属性名
     *  @para value 改变后的属性值
     *  @para compare 是否需要比较， 有時候需要強制更新
     */
    static activePropertyForComponent(componentId: number, property: string, value: any): void {
        let viewModel = ViewModelManager.viewModel.get(componentId).get(property);
        viewModel.dependences.forEach(v => {v.apply(null, [value]); });
    }

    static deleteViewModel(id: number) {
        ViewModelManager.viewModel.delete(id);
    }
}

window['_ViewModelManager'] = ViewModelManager;
