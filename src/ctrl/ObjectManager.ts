export default class ObjectManager {
    private static objects: Map<number, any> = new Map<number, any>();

    static getObject<T>(id): T {
        return ObjectManager.objects.get(id);
    }

    static setObject(id, obj) {
        ObjectManager.objects.set(id, obj);
    }

    static deleteObject(id) {
        let o = ObjectManager.getObject(id);
        if (o.constructor['name'] === 'Shadow') {
            console.log(o.constructor['name'], id);
        }
        ObjectManager.objects.delete(id);
    }

    static hasObject(id) {
        return ObjectManager.objects.has(id);
    }
}

window['_ObjectManager'] = ObjectManager;
