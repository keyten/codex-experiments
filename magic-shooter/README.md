# Magic Shooter

A simple Three.js demo of a third-person sword and magic fight.

The demo uses a GLB model with sword, block, dodge and spellcasting animations.  
The `modelUrl` in `main.js` references a freely available Mixamo-based model.  
Replace it with any GLB that provides the required animation clips named:
`Idle`, `Run`, `Attack`, `Block`, `Dodge`, `Cast`, and `Shield`.

## Controls

- **WASD** – Move
- **Click** – Sword strike
- **Space** – Block
- **Z** – Dodge
- **X** – Fireball
- **Q** – Teleport to aimed point
- **E** – Magical shield

Two AI enemies use the same abilities. All characters are immortal.

Run a local web server inside this folder to play:

```bash
npx http-server
```
