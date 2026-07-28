# Atribución de los sonidos ambiente

Los archivos de `public/ambient/` son grabaciones de campo de Wikimedia Commons,
recortadas, ecualizadas, normalizadas y convertidas en bucles sin costura por
`tools/build-ambient.sh`. Cada uno es por lo tanto una **obra derivada** de su
original.

El ruido blanco no está en la lista: se sintetiza en el navegador
(`src/audio/ambient.ts`) y no proviene de ninguna grabación.

| Archivo | Original | Autor | Licencia |
|---|---|---|---|
| `rain.m4a` | [Rain against the window](https://commons.wikimedia.org/wiki/File:Rain_against_the_window.ogg) | Cori Samuel | Dominio público |
| `cafe.m4a` | [Restaurant ambience](https://commons.wikimedia.org/wiki/File:Restaurant_ambience.ogg) | stephan | Dominio público |
| `waves.m4a` | [Oceanwavescrushing](https://commons.wikimedia.org/wiki/File:Oceanwavescrushing.ogg) | Luftrum | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) |
| `fire.m4a` | [Campfire sound ambience](https://commons.wikimedia.org/wiki/File:Campfire_sound_ambience.ogg) | Glaneur de sons | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) |
| `wind.m4a` | [Wind in Swedish pine forest at 25 mps](https://commons.wikimedia.org/wiki/File:Wind_in_Swedish_pine_forest_at_25_mps.ogg) | W.carter | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) |

## Qué obliga cada licencia

**Dominio público** (`rain.m4a`, `cafe.m4a`) — sin obligaciones. Se listan igual
por cortesía con quien grabó.

**CC BY 3.0** (`waves.m4a`, `fire.m4a`) — hay que dar crédito al autor, indicar la
licencia y señalar que el archivo fue modificado. Esta tabla cumple con eso. La
obra derivada puede distribuirse bajo cualquier licencia.

**CC BY-SA 4.0** (`wind.m4a`) — lo mismo que CC BY, y además **el archivo derivado
tiene que distribuirse también bajo CC BY-SA 4.0**. Es la única obligación viral
del conjunto y alcanza solo a ese archivo de audio, no al código de la app.

> Si esa condición no sirve para cómo se vaya a distribuir el proyecto, hay que
> reemplazar la fuente del viento por una de dominio público o CC BY y volver a
> correr `tools/build-ambient.sh`. Es el único de los cinco que arrastra
> share-alike.

## Si la app se publica

Las licencias CC BY y CC BY-SA piden que el crédito acompañe a la obra "de una
manera razonable". Este archivo se versiona junto al código, pero en un despliegue
público conviene además que los créditos sean visibles desde la interfaz.
