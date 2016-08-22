import {AbstractSence, AbstractSenceConstructor} from '../abstract/AbstractSence';
import {ComponentNode} from './ComponentManager';
import ComponentManager from './ComponentManager';
import {Getter} from './DirectiveManager';
import counter from './Counter';
import ViewModelManager from './ViewModelManager';
import {ActiveProperties} from './ActivePropertyManager';
import ActivePropertyManager from './ActivePropertyManager';
import DisplayObjectManager from './DisplayObjectManager';
import {Game} from '../abstract/LayaObject';

interface NamedSenceData {
    node:             ComponentNode;
    newFunc:          AbstractSenceConstructor;
}

export default class SenceManager {
    private static registers: Map<string, NamedSenceData>         = new Map<string, NamedSenceData>();
    private static instances: Map<number, AbstractSence>          = new Map<number, AbstractSence>();

    static reigsterSence(newFunc: AbstractSenceConstructor, cptNode: ComponentNode) {
        let name: string  = newFunc['name'];
        let activeProperties: ActiveProperties = {
                                         data:   new Set<string>(),
                                         getter: new Set<Getter>()
                                     };
        SenceManager.registers.set(name, {
            node:             cptNode,
            newFunc:          newFunc
        });
        ActivePropertyManager.initActiveProperty(name, activeProperties);
    }

    static buildSence(name: string, build: AbstractSence, game: Game): AbstractSence {
        let registe = SenceManager.registers.get(name);
        let newFunc = registe.newFunc;
        let node    = registe.node;
        build['id'] = counter();
        build.setLayaGame(game);
        SenceManager.instances.set(build['id'], build);
        ViewModelManager.initSenceViewModel(build, ActivePropertyManager.getActiveProperties(name));

        node.children.forEach(v => {
            let name = v.name;
            if (ComponentManager.hasComponent(name)) {
                let c = ComponentManager.buildComponent(build, v, build.getWorld(), build.getLayaGame());
                build.addSubComponent(c);
            } else {
                build.getWorld().add(DisplayObjectManager.buildDisplayObject(build, v, build.getLayaGame()));
            }
        });
        return build;
    }

    static getAllRegisters(): Array<AbstractSenceConstructor> {
        let ret = [];
        SenceManager.registers.forEach(v => {
            ret.push(v.newFunc);
        });
        return ret;
    }

    static getByName(name: string): AbstractSenceConstructor {
        return SenceManager.registers.get(name).newFunc;
    }
}

window['_senceManager'] = SenceManager;