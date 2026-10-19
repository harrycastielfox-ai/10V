# NEXO demonstration — synthetic portraits 01–25

Mode: built-in `image_gen.imagegen`; one independent generation per asset. No CLI/API fallback, no source photographs, no real-person reference. Generated PNGs are copied unmodified into the project. All subjects are wholly invented adults. Footer explicitly identifies fictional demonstration content.

## Final prompt set

For assets 02–25, the final prompt is the common prefix, the corresponding subject text, then the common suffix. Asset 01 used the same constraints with the first subject incorporated directly after “completely invented adult”.

Common prefix:

> Use case: photorealistic-natural. Asset type: synthetic fictional person portrait for a clearly labeled software demonstration. Create ONE square color photographic studio head-and-shoulders portrait of a completely invented person. Subject:

Common suffix:

> Calm neutral expression, facing camera, shoulders visible, realistic skin texture, soft even studio lighting, light slate-gray background. No identity reference and no resemblance intentionally to any real person. Composition centered with a narrow unobtrusive footer at bottom. Footer text verbatim: 'PESSOA FICTÍCIA · DEMONSTRAÇÃO', dark slate clean small sans-serif, fully readable. No police, prison, mugshot, measurement chart, weapons, uniforms, criminal marks, intimidating pose, logos, or other people. This person and all biographical use are wholly fictional. Produce a single finished portrait, not a contact sheet.

| Asset path                                 | Subject                                                                                                                                                 |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `public/nexo-demo/portraits/person-01.png` | Adult man, age 42, medium tan skin, short dark wavy hair with a few gray strands, neatly trimmed short beard, brown eyes, plain navy crew-neck T-shirt. |
| `public/nexo-demo/portraits/person-02.png` | Adult woman, age 34, warm medium-brown skin, shoulder-length natural black curls, dark eyes, no glasses, plain muted teal blouse.                       |
| `public/nexo-demo/portraits/person-03.png` | Adult man, age 29, deep brown skin, close-cropped black hair, clean-shaven face, dark eyes, plain slate-blue T-shirt.                                   |
| `public/nexo-demo/portraits/person-04.png` | Adult man, age 55, light olive skin, short silver-gray hair, salt-and-pepper mustache, dark eyes, plain charcoal polo shirt.                            |
| `public/nexo-demo/portraits/person-05.png` | Adult woman, age 46, fair skin with freckles, chin-length straight chestnut hair, hazel eyes, simple dark rectangular glasses, plain navy blouse.       |
| `public/nexo-demo/portraits/person-06.png` | Adult man, age 38, golden-brown skin, short straight black hair, clean-shaven face, dark brown eyes, plain gray collared shirt.                         |
| `public/nexo-demo/portraits/person-07.png` | Adult man, age 60, deep brown skin, bald head, neatly trimmed gray beard, brown eyes, plain muted blue crew-neck sweater.                               |
| `public/nexo-demo/portraits/person-08.png` | Adult man, age 26, light tan skin, thick dark brown wavy hair, clean-shaven face, brown eyes, plain forest-green T-shirt.                               |
| `public/nexo-demo/portraits/person-09.png` | Adult woman, age 52, medium olive skin, dark hair with silver strands tied back simply, brown eyes, no glasses, plain soft gray blouse.                 |
| `public/nexo-demo/portraits/person-10.png` | Adult man, age 43, medium brown skin, short curly black hair, light stubble, dark eyes, simple thin round glasses, plain navy shirt.                    |
| `public/nexo-demo/portraits/person-11.png` | Adult man, age 31, fair skin, short light-brown hair, clean-shaven face, blue-gray eyes, plain charcoal crew-neck shirt.                                |
| `public/nexo-demo/portraits/person-12.png` | Adult woman, age 28, deep brown skin, short natural coiled black hair, dark eyes, plain muted burgundy blouse.                                          |
| `public/nexo-demo/portraits/person-13.png` | Adult man, age 48, light tan skin, receding dark hair with silver temples, neatly trimmed beard, brown eyes, plain dark teal polo shirt.                |
| `public/nexo-demo/portraits/person-14.png` | Adult man, age 36, medium olive skin, straight black hair cut short, clean-shaven face, dark eyes, plain slate-gray crew-neck T-shirt.                  |
| `public/nexo-demo/portraits/person-15.png` | Adult man, age 58, warm brown skin, short salt-and-pepper curls, clean-shaven face, brown eyes, simple dark rectangular glasses, plain muted navy polo. |
| `public/nexo-demo/portraits/person-16.png` | Adult woman, age 40, light brown skin, shoulder-length wavy dark hair, dark eyes, plain indigo blouse.                                                  |
| `public/nexo-demo/portraits/person-17.png` | Adult man, age 27, medium tan skin, short tightly curled black hair, small tidy mustache, dark eyes, plain olive-green shirt.                           |
| `public/nexo-demo/portraits/person-18.png` | Adult man, age 51, fair skin, shaved head, neatly trimmed short dark-gray beard, hazel eyes, plain muted blue collared shirt.                           |
| `public/nexo-demo/portraits/person-19.png` | Adult woman, age 57, deep brown skin, short silver natural curls, brown eyes, understated thin glasses, plain dark teal blouse.                         |
| `public/nexo-demo/portraits/person-20.png` | Adult man, age 33, medium brown skin, thick wavy dark hair brushed back, clean-shaven face, dark eyes, plain navy crew-neck shirt.                      |
| `public/nexo-demo/portraits/person-21.png` | Adult man, age 44, light olive skin, short curly chestnut hair, tidy mustache and light beard, brown eyes, plain gray polo.                             |
| `public/nexo-demo/portraits/person-22.png` | Adult man, age 39, deep brown skin, very short black hair, clean-shaven face, dark eyes, plain muted maroon T-shirt.                                    |
| `public/nexo-demo/portraits/person-23.png` | Adult woman, age 30, golden tan skin, straight dark shoulder-length hair, brown eyes, plain slate-blue blouse.                                          |
| `public/nexo-demo/portraits/person-24.png` | Adult man, age 54, medium brown skin, short dark hair with gray at temples, clean-shaven face, brown eyes, plain muted sage collared shirt.             |
| `public/nexo-demo/portraits/person-25.png` | Adult man, age 45, light tan skin, short dark wavy hair, clean-shaven face, hazel eyes, simple rectangular glasses, plain charcoal shirt.               |

Each image is visually checked for a single adult, neutral composition, no prohibited props, and the fictional footer. This file documents production assets, not actual identities or criminal associations.
