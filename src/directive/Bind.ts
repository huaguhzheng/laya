import {AbstractComponent} from '../abstract';
import {AbstractSence} from '../abstract';
import ViewModelManager from '../ctrl/ViewModelManager';
import ObjectManager from '../ctrl/ObjectManager';
import Is from '../util/Is';

export default {
    name: 'bind',

    bind(cpt: AbstractComponent | AbstractSence, target: any, argument: string, value: (context) => any, triggers: Array<string>) {
        let id     = cpt.getId();
        let targetId = target.getId();
        triggers.forEach((v) => {
                    if (cpt.hasOwnActiveProperty(v)) {
                        // if (target instanceof AbstractComponent) {
                        //     ViewModelManager.addDependences(id, v, (() => {
                        //         let context = ObjectManager.getObject(id);
                        //         ViewModelManager.activePropertyForComponent(targetId, argument, value(context));
                        //     }));
                        // } else { // 对于 displayObject 和 supportObject 直接给相应属性赋值即可
                        ViewModelManager.addDependences(id, v, ((contextId, targetId, value) => {
                            let target = ObjectManager.getObject(targetId);
                            let context = ObjectManager.getObject(contextId);
                            if (Is.isPresent(target) && Is.isPresent(context)) {
                                target[argument] = value(context);
                            }
                        }).bind(null, id, targetId, value));
                        // }
                    } else {
                        // console.warn(cpt.constructor['$$name'] + '组件，没有属性名为: ' + v + '的响应式属性.');
                    }
                });
    },

    unbind() {
        console.log('un do');
    }
};
