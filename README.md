# 鼠尾草峽谷大冒險 · Sage Canyon Quest

An open-world adventure in the browser, in the spirit of *Breath of the Wild*, that starts at Sage Canyon School. Josh wakes on the school field to find a grey fog, the Gloom, covering the canyon. He clears the shrines around campus, earns a kite-glider, frees four great shrines and climbs Black Mountain to drive the Gloom away. Chinese and English; keyboard and mouse or touch.

Play: https://ywchen0711.github.io/sage-canyon/

*A work of fiction.* The campus is laid out approximately after an aerial view, at about twice life size, with no room labels or other details. The land around it, the canyon, the creek, the hills and the station on Black Mountain, is made up for the game. Josh, Jasper, Dad (Jeff) and Mom (Erin) are the family from [Canyon Kids](https://ywchen0711.github.io/canyon-kids-comic/).

## The land
- **Sage Canyon School**, on a mesa where you start:
  - the big field with goals, along Carmel Mountain Road;
  - the blacktop with the basketball court, four square, tetherball and a play structure;
  - the lunch shelter;
  - the two-story building and the classroom wings around the garden courtyard;
  - the portables;
  - the parking lots.
- **Sage Canyon** and **Canyon Creek** wind along the west and south of the school: sandstone walls, sage scrub, sycamores along the creek.
- **The Canyon Neighborhood** lies east, with Josh's home on its street.
- **The Carmel Hills** rise north of the road up to **Black Mountain**, where the Gloom waits in an old radio station.
- **The West Shore** is where the land meets the sea.

## Playing
Everything from the Windborne engine:
- climbing anything (roofs, trees, play structures, canyon walls) with a stamina wheel;
- gliding, swimming, sprinting;
- breakable weapons, bows and shields;
- the magnet, bomb, ice and stasis runes in shrines;
- towers that reveal the map, with fast travel;
- cooking, leaf-sprite seeds, day and night, and rain.

Dad sends you to the great shrines. Mom lets you sleep at home to restore your hearts. Jasper knows where a glowing sword is hidden.

## Controls
- **Keyboard and mouse:**
  - WASD: move. Mouse: look (click to lock). Shift: sprint. Space: jump / climb-jump / glide.
  - Left click: attack. Hold right click: bow. Q: shield.
  - E: interact. R: rune. Wheel or [ ]: switch weapons. C: let go while climbing. Tab: inventory. M: map.
- **Touch:** a stick on the left, drag on the right to look, and buttons.

## Code
Plain ES modules and three.js (from the CDN), built on Windborne's engine. `js/world.js` holds the campus layout (`px()` maps the aerial picture's pixels to the world) and the land around it. `npm test` checks the campus, the land, the physics, cooking and every shrine.
