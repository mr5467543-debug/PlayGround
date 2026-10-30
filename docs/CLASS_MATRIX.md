# The 50-Class Matrix

> Generated from `design/classes.json` by `tools/validate-classes.mjs --matrix`.
> **Do not edit by hand.** Edit the JSON, then regenerate.

Every legal distribution of 10 points across the six stats (3003 builds) maps to exactly one class.
Secret callings are checked globally first. Otherwise the two highest stats select a lane
(`PURE_<STAT>` when the top stat is 6+ and the second is 2 or less, else the canonical pair).
Within a lane, classes are checked by descending priority; the last class in each lane is the lane default.

## Pure (10)

| Class | Lane | Requirement | Signature skill | Builds |
| --- | --- | --- | --- | ---: |
| **The Muscle Wizard** | PURE_STR | STR >= 7, INT >= 2 | Haymaker | 5 |
| **The Ghost** | PURE_DEX | DEX >= 8, VIT <= 1 | Ghost Step | 19 |
| **The Glass Cannon** | PURE_INT | INT >= 8 | Meteor Shard | 20 |
| **The Wall** | PURE_VIT | VIT >= 8 | Shield Bash | 11 |
| **The Hearth** | PURE_VIT | WIS >= 2 | Warm Light | 12 |
| **The Colossus** | PURE_STR | — (lane default) | Cleave | 77 |
| **The Duelist** | PURE_DEX | — (lane default) | Lunge | 76 |
| **The Archivist** | PURE_INT | — (lane default) | Ink Blot | 74 |
| **The Oracle** | PURE_WIS | — (lane default) | Foresight | 42 |
| **The Fool** | PURE_LUK | — (lane default) | Trip | 84 |

## Hybrid (20)

| Class | Lane | Requirement | Signature skill | Builds |
| --- | --- | --- | --- | ---: |
| **The Monk** | STR+DEX | STR >= DEX | Flurry | 129 |
| **The Paladin** | STR+INT | STR > INT, INT > WIS, WIS >= 1 | Smite | 26 |
| **The Bruiser** | STR+VIT | STR >= VIT | Body Blow | 69 |
| **The Reaver** | STR+LUK | STR > LUK | Rend | 41 |
| **The Spellblade** | DEX+INT | INT > DEX | Arcane Slash | 70 |
| **The Spellthief** | DEX+INT | DEX > INT, DEX >= 5 | Mana Siphon | 33 |
| **The Skirmisher** | DEX+VIT | DEX >= VIT | Hit and Run | 93 |
| **The Ranger** | DEX+WIS | LUK >= 2 | Hunter's Mark | 38 |
| **The Buccaneer** | STR+DEX | — (lane default) | Saber Slash | 84 |
| **The Hexblade** | STR+INT | — (lane default) | Cursed Edge | 163 |
| **The Warpriest** | STR+WIS | — (lane default) | War Hymn | 144 |
| **The Corsair** | STR+LUK | — (lane default) | Cutlass | 114 |
| **The Nightblade** | DEX+INT | — (lane default) | Umbral Cut | 75 |
| **The Stalker** | DEX+WIS | — (lane default) | Silent Shot | 94 |
| **The Trickster** | DEX+LUK | — (lane default) | Sleight | 135 |
| **The Theurge** | INT+WIS | INT >= WIS | Twin Bolt | 74 |
| **The Inquisitor** | INT+WIS | — (lane default) | Brand | 45 |
| **The Wild Mage** | INT+LUK | — (lane default) | Chaos Bolt | 128 |
| **The Gravewarden** | VIT+LUK | — (lane default) | Grave Bolt | 117 |
| **The Pilgrim** | WIS+LUK | — (lane default) | Lantern | 111 |

## Tank (10)

| Class | Lane | Requirement | Signature skill | Builds |
| --- | --- | --- | --- | ---: |
| **The Crusader** | STR+VIT | WIS >= 2 | Shield Charge | 41 |
| **The Bulwark** | DEX+VIT | VIT >= 6 | Shield Wall | 6 |
| **The Anchor** | PURE_VIT | — (lane default) | Hold Fast | 56 |
| **The Juggernaut** | STR+VIT | — (lane default) | Ram | 68 |
| **The Ironclad** | DEX+VIT | — (lane default) | Hammerfall | 65 |
| **The Necrophage** | INT+VIT | LUK >= 2 | Carrion Bite | 38 |
| **The Warlock** | INT+VIT | — (lane default) | Drain Life | 111 |
| **The Shaman** | VIT+WIS | LUK >= 2 | Totem | 32 |
| **The Templar** | VIT+WIS | VIT >= WIS | Shield of Faith | 58 |
| **The Sentinel** | VIT+WIS | — (lane default) | Ward | 32 |

## Specialized / Secret (10)

| Class | Lane | Requirement | Signature skill | Builds |
| --- | --- | --- | --- | ---: |
| **The Equilibrium** | Global | shape 2/2/2/2/1/1 | Even Hand | 15 |
| **The Gambler** | Global | LUK >= 6, DEX >= 2, LUK > DEX, STR <= 1, INT <= 1, VIT <= 1, WIS <= 1 | Coin Flip | 17 |
| **The Berserker** | Global | STR >= 8, VIT <= 2, INT <= 1, WIS == 0 | Reckless Swing | 14 |
| **The Oathbreaker** | Global | STR == INT, INT == WIS, STR >= 2 | Broken Vow | 15 |
| **The Ascetic** | Global | VIT == 0, LUK == 0, WIS >= 3, STR <= 4, DEX <= 4, INT <= 4 | Empty Palm | 89 |
| **The Blind Prophet** | Global | WIS >= 6, DEX == 0, LUK <= 1 | Foreseen Blow | 40 |
| **The Heretic** | Global | INT >= 5, WIS == 0, STR >= 2, VIT >= 2 | Profane Bolt | 5 |
| **The Martyr** | Global | VIT >= 7, STR == 0, DEX == 0 | Offering | 20 |
| **The Thing That Waits** | Global | STR >= 1, DEX >= 1, INT >= 1, VIT >= 1, WIS >= 1, LUK >= 1, STR <= 3, DEX <= 3, INT <= 3, VIT <= 3, WIS <= 3, LUK <= 3 | Linger | 75 |
| **The Singularity** | Global | shape 10/0/0/0/0/0 | Perfect Strike | 3 |

## Lane coverage

| Lane | Builds | Class(es) |
| --- | ---: | --- |
| DEX+INT | 191 | The Spellblade, The Spellthief, The Nightblade |
| DEX+LUK | 145 | The Trickster |
| DEX+VIT | 171 | The Bulwark, The Skirmisher, The Ironclad |
| DEX+WIS | 156 | The Ranger, The Stalker |
| INT+LUK | 131 | The Wild Mage |
| INT+VIT | 157 | The Necrophage, The Warlock |
| INT+WIS | 142 | The Theurge, The Inquisitor |
| PURE_DEX | 96 | The Ghost, The Duelist |
| PURE_INT | 96 | The Glass Cannon, The Archivist |
| PURE_LUK | 96 | The Fool |
| PURE_STR | 96 | The Muscle Wizard, The Colossus |
| PURE_VIT | 96 | The Wall, The Hearth, The Anchor |
| PURE_WIS | 96 | The Oracle |
| STR+DEX | 236 | The Monk, The Buccaneer |
| STR+INT | 209 | The Paladin, The Hexblade |
| STR+LUK | 163 | The Reaver, The Corsair |
| STR+VIT | 189 | The Crusader, The Bruiser, The Juggernaut |
| STR+WIS | 174 | The Warpriest |
| VIT+LUK | 120 | The Gravewarden |
| VIT+WIS | 131 | The Shaman, The Templar, The Sentinel |
| WIS+LUK | 112 | The Pilgrim |
