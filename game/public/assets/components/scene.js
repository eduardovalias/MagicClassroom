import createPlayer from "./player.js";
import createKeyListner from "./keyboard-listner.js";
import createChat from "./chat.js";
import createGameObject from "./gameObject.js";

export default function createScene(htmlDOM, PIXI) {
    let left, up, down, right;
    let observers = [];
    let app;
    let currentPlayer;
    let currentPlayerId;
    let sheet;
    let chat;
    let state = {
        players: {},
    }
    let colideableGameObjects = [];
    let map = [];
    let layers = {
        players: new PIXI.Container(),
        background: new PIXI.Container(),
        objects: new PIXI.Container(),
        UI: new PIXI.Container(),
    }
    let layerManager = new PIXI.Container();

    const loader = PIXI.Loader.shared;
    const ticker = PIXI.Ticker.shared;

    function init(element){
        app = new PIXI.Application({
            view: element,
            width: window.innerWidth,
            height: window.innerHeight,
            backgroundColor: 0xffffff,
            resolution: 1,
            resizeTo: window,
            autoResize: true
        });
        PIXI.settings.SCALE_MODE = PIXI.SCALE_MODES.NEAREST;
        PIXI.settings.ROUND_PIXELS = true;
        PIXI.settings.SORTABLE_CHILDREN = true;

        loadAssets();
    }

    function loadAssets(){
        
        loader.add("assets/sprites/spriteSheet.json");

        loader.load((loader, resources) => {
            sheet = resources["assets/sprites/spriteSheet.json"].spritesheet;
            notifyAll({
                type: 'client-ready'
            });
        });

        loader.onProgress.add((loader, resource) => {
            console.log(`Loading... ${loader.progress}%`);
            console.log(`Resource: ${resource.name}`);
        });

        loader.onError.add((loader, resource) => {
            console.log(`An error ocurred when loading, ${resource.name}`)
        });

    }

    function setup(clientId, newState){ 
        currentPlayerId = clientId;
        setState(newState);
        currentPlayer = state.players[currentPlayerId];
        app.stage.SORTABLE_CHILDREN = true;

        layerManager.addChild(layers.background);
        layerManager.addChild(layers.objects);
        layerManager.addChild(layers.players);
        layerManager.addChild(layers.UI);
        layers.background.zIndex = -1;
        layers.objects.zIndex = 0;
        layers.players.zIndex = 1;
        layers.UI.zIndex = 2;
        app.stage.addChild(layerManager);


        ticker.add(delta => update(delta));
        subscribeKeys();
        
        chat = createChat(PIXI, app, (message) =>{
            notifyAll({
                type: 'chat-message',
                id: clientId,
                text: message,
            })
        });
 
        chat.onFocus(() => {
            unsubscribeKeys();
        })
        
        chat.onBlur(() => {
            subscribeKeys();
        })
        
        addOnStage(chat.body, "UI")
        constructMap(/* receipe */);
    }

    function update(delta) {
        checkCollision();
    }

    function checkCollision() {
        if(!colideableGameObjects) return
        colideableGameObjects.forEach(obj => {
            if(boxesIntersect(currentPlayer.spriteContainer, obj)){
                let dir = currentPlayer._facing;
                switch(dir){
                    case "up":
                        currentPlayer.input.y = 0; 
                        currentPlayer.body.y += 2
                        break;
                    case "down":
                        currentPlayer.input.y = 0; 
                        currentPlayer.body.y -= 2
                        break;
                    case "left": 
                        currentPlayer.input.x = 0
                        currentPlayer.body.x += 2
                        break;
                    case "right":
                        currentPlayer.input.x = 0
                        currentPlayer.body.x -= 2
                        break;
                    default:
                        break;
                }
                currentPlayer.blockedDirections.push(currentPlayer._facing);
            }
            else{
                currentPlayer.blockedDirections = []
            }

        });
    }

    function boxesIntersect(a, b)
    {
        var ab = a.getBounds();
        var bb = b.getBounds();
        
        return ab.x + ab.width > bb.x && ab.x < bb.x + bb.width && ab.y + ab.height > bb.y && ab.y < bb.y + bb.height;
    }

    function addColision(obj){
        colideableGameObjects.push(obj);
        console.log(colideableGameObjects)
    }

    function constructMap(){
        let shop1 = createGameObject(PIXI, sheet.textures["shop.png"], {x: 600, y: 400}, false);
        addOnStage(shop1)
        addColision(shop1)

        let shop2 = createGameObject(PIXI, sheet.textures["shop.png"], {x: 300, y: 400}, false);
        addOnStage(shop2)
        addColision(shop2)

        let grass = new PIXI.TilingSprite(
            sheet.textures["grass_floor1.png"],
            1000,
            1000
        );
        grass.x = 0;
        grass.y = 0;
        grass.anchor.set(0)
        grass.scale.set(2,2);
        addOnStage(grass, "background")
    }

    function receiveChatMessage(msg){
        chat.receiveMessage(msg);
    }

    function setState(newState){
        const players = newState.players;

        for(const player in players) {
            addPlayer(players[player]);
        }
        
    }

    function addPlayer(newPlayer){
        const player = createPlayer(newPlayer.id, notifyAll, PIXI, sheet);

        player.spriteId = newPlayer.spriteId;
        player.velocity = newPlayer.velocity;
        
        player.setPosition({x: newPlayer.x, y: newPlayer.y});
        ticker.add(delta => player.loop(delta));
        player.body.zIndex = player.body.y/10;
        addOnStage(player.body, "players");
        state.players[player.id] = player;
    }

    function removePlayer(playerId){
        const player = state.players[playerId];
        ticker.remove(player.loop());
        delete state.players[playerId];
    }

    function subscribeKeys() {
        left = createKeyListner("a"),
        up = createKeyListner("w" ),
        right = createKeyListner("d"),
        down = createKeyListner("s");
        
        setKeyInputs();
    }

    function unsubscribeKeys(){
        left.unsubscribe();
        right.unsubscribe();
        up.unsubscribe();
        down.unsubscribe();
    }

    function setKeyInputs(){  
        const player = state.players[currentPlayerId];
        left.press = () => {
            if(right.isDown || up.isDown || down.isDown) return;
            
            player.setInputX(-1);
        };

        left.release = () => {
            if(right.isDown) {
                player.setInputX(1);
            }
            else if(up.isDown){
                player.setInputY(-1);
            }
            else if(down.isDown){
                player.setInputY(1);
            }
            player.setInputX(0)
        };

        right.press = () => {
            if(left.isDown || up.isDown || down.isDown) return;
            player.setInputX(1);
        };

        right.release = () => {
            if(left.isDown) {
                player.setInputX(-1);
                return;
            }
            else if(up.isDown){
                player.setInputY(-1);
            }
            else if(down.isDown){
                player.setInputY(1);
            }
            player.setInputX(0)
        };

        up.press = () => {
            if(down.isDown || left.isDown || right.isDown) return
            player.setInputY(-1)
        };

        up.release = () => {
            if(down.isDown){
                player.setInputY(1)
                return
            }
            else if(left.isDown){
                player.setInputX(-1);
            }
            else if(right.isDown){
                player.setInputX(1);
            }
            player.setInputY(0)
        };

        down.press = () => {
            if(up.isDown || left.isDown || right.isDown) return;
            player.setInputY(1);
        };

        down.release = () => {
            if(up.isDown){
                player.setInputY(-1);
                return;
            }
            else if(left.isDown){
                player.setInputX(-1);
            }
            else if(right.isDown){
                player.setInputX(1);
            }
            player.setInputY(0);
        };
    }

    function moveProxy(movement) {
        const playerId = movement.id;
        const player = state.players[playerId];
        if(!player) return;
        const input = movement.input;
        const position = movement.position
      
        player.input = input;
        player.setAnimation()
        player.setPosition(position);
    }

    function addOnStage(object, layer){
        if(!layer){
            layer = "objects";
        }
        layers[layer].addChild(object)
    }

    function subscribe(observerFunction) {
        observers.push(observerFunction);
    }

    function notifyAll(command) {
        for(const observerFunction of observers){
            observerFunction(command);
        }
    }

    init(htmlDOM);
    return{
        setup,
        addPlayer,
        removePlayer,
        receiveChatMessage,
        moveProxy,
        subscribe,
    }
}