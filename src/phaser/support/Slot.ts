import Game from '../display/Game';
import support from '../../decorators/Support';
import {AbstractSupportObject} from '../../abstract/AbstractSupport';

@support({
    require: ['name'],
    optional: [],
    name: 'Slot'
})
export default class Slot extends AbstractSupportObject {
    constructor(game: Game, target: any, require: any, optional: any, id: number) {
        super(id);
    }

    destroy() {
        //
    }
}
