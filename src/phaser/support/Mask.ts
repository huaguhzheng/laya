import Game from '../display/Game';
import support from '../../decorators/Support';
import Is from '../../util/Is';
import {AbstractSupportObject} from '../../abstract/AbstractSupport';
import Rectangle from './Rectangle';

@support({
    require: ['x', 'y']
})
export default class Mask extends AbstractSupportObject {

    graphics: Phaser.Graphics;

    constructor(game: Game, require: any, optional: any) {
        super();
        this.graphics = new Phaser.Graphics(game.realGame, require.x, require.y);
    }

    getRealObject(): Phaser.Graphics {
        return this.graphics;
    }

    destroy(): void {
        this.graphics.destroy(true);
    }

    set alpha(value: number) {
        this.graphics.alpha = value;
    }

    set beginFill(value: number) {
        this.graphics.beginFill(value);
    }

    set x(value: number) {
        this.graphics.x = value;
    }

    set y(value: number) {
        this.graphics.y = value;
    }

    set Rectangle (value: Rectangle) {
        this.graphics.drawShape(<any>value.getRealObject());
    }
}