/**
 * Surface EVA sites reused from Access Mars (Google Creative Lab · NASA/JPL-Caltech, Apache-2.0).
 * Terrain meshes are reconstructed from Curiosity stereo imagery (Gale crater). Positions are metres
 * in the site frame (y up). POI texts are quoted from Access Mars; see public/eva/NOTICE.md.
 */

export interface EvaPoi { id: string; title: string; text: string; image: string; position: [number, number, number]; weight: number }
export interface EvaSite { id: string; name: string; description: string; traverseDistance: string; traverseKm: number; basePath: string; pois: EvaPoi[] }

/** Science weight of each POI for EVA planning (MODEL ASSUMPTION: drill/outcrop targets weigh more than context views). */
export const EVA_SITES: EvaSite[] = [
  {
    id: "landing_site",
    name: "Bradbury Landing",
    description: "Curiosity's landing site (August 2012) on the floor of Gale crater.",
    traverseDistance: "0 km (landing)",
    traverseKm: 0,
    basePath: "/eva/gale/landing_site",
    pois: [
      { id: "ls3", title: "Satellite View", text: "This photo taken from the Mars Reconnaissance Orbiter shows the landing site where you're standing now. It also shows where other parts of the landing system ended up, like the rocket-powered descent stage and the parachute.", image: "/eva/cards/ls1.jpg", position: [21.0, 0.0, 0.0], weight: 0.3 },
      { id: "ls2", title: "Is This Terrain Real?", text: "All the terrain around you has been created using real data and images from Curiosity. By taking photos with two side-by-side cameras we can reconstruct the terrain in 3D.", image: "/eva/cards/ls2.jpg", position: [14.0, 0.0, 6.0], weight: 0.3 },
      { id: "ls1", title: "Black And White Tiles", text: "Some areas are black and white because they were only photographed by Curiosity's lower resolution navigation cameras. Frequently, Curiosity has to move on before it can photograph everything with its higher resolution Mastcams.", image: "/eva/cards/ls3.jpg", position: [-9.0, 0.0, 4.0], weight: 0.2 },
    ],
  },
  {
    id: "pahrump_hills",
    name: "Pahrump Hills",
    description: "Mudstone outcrops at the base of Mount Sharp, studied from September 2014.",
    traverseDistance: "\u2248 9.7 km along the traverse",
    traverseKm: 9.7,
    basePath: "/eva/gale/pahrump_hills",
    pois: [
      { id: "ph1", title: "Arrival", text: "Curiosity arrived in Pahrump Hills in September 2014. It began conducting a walkabout of the area, the same way geologists on Earth do field work. It surveyed the area, then scientists chose which sites to examine more closely.", image: "/eva/cards/ph1.jpg", position: [1.9, 1.0, -3.9], weight: 0.5 },
      { id: "ph2", title: "Ancient History", text: "Sedimentary rocks in this area appear to have formed in the presence of water. Scientists think this could have been the bottom of a lake, billions of years ago.", image: "/eva/cards/ph2.jpg", position: [2.8, 2.5, -7.3], weight: 0.8 },
      { id: "ph3", title: "Drill Site", text: "Curiosity analyzed several samples in this area using its drill and instruments. Minerals found here suggest that the chemistry of this lake was changing. This suggests that environments on Mars capable of supporting life varied over time.", image: "/eva/cards/ph3.jpg", position: [6.98, 1.13, -5.61], weight: 1.0 },
      { id: "ph4", title: "Mount Sharp", text: "Pahrump Hills is at the base of Mount Sharp, a major objective for Curiosity. From orbit, we have seen layers of minerals reaching from the floor of Gale Crater to the foot hills of Mount Sharp. By climbing up the slope, layer by layer, Curiousity can reveal clues about the history of Mars, and its potential ability to support life.", image: "/eva/cards/ph4.jpg", position: [-28.9, 4.3, -10.7], weight: 0.6 },
    ],
  },
  {
    id: "marias_pass",
    name: "Marias Pass",
    description: "Contact between younger sandstone and older mudstone; Buckskin drill target (2015).",
    traverseDistance: "\u2248 10.8 km along the traverse",
    traverseKm: 10.8,
    basePath: "/eva/gale/marias_pass",
    pois: [
      { id: "mp1", title: "Arrival", text: "Curiosity arrived in Marias Pass on May 20, 2015. Here, a younger layer of sandstone sits atop an older layer of mudstone, potentially preserving clues about ancient changes in the Martian environment.", image: "/eva/cards/mp1.jpg", position: [8.85, -0.65, 5.6], weight: 0.5 },
      { id: "mp2", title: "Buckskin", text: "This target is named \"Buckskin.\" A sample drilled here showed high levels of silica, which could be promising for preserving organic material. It also showed traces of the mineral tridymite, which was left behind by volcanic activity.", image: "/eva/cards/mp2.jpg", position: [6.1, -0.3, 22.0], weight: 1.0 },
      { id: "mp3", title: "Selfie", text: "Curiosity took this selfie here in August 2015. Observations like this are used to monitor dust deposits, wear on the rover's wheels, and other signs of aging.", image: "/eva/cards/mp3.jpg", position: [10.8, -0.4, 19.4], weight: 0.4 },
      { id: "mp4", title: "Conjunction", text: "Curiosity spent all of June 2015 parked in this spot, because Mars and Earth were on opposite sides of the Sun. When this 'conjunction' happens, radio signals between Mars and Earth become unreliable, so commands aren't sent to Curiosity.", image: "/eva/cards/mp4.jpg", position: [2.16, -1.17, 4.88], weight: 0.4 },
    ],
  },
  {
    id: "murray_buttes",
    name: "Murray Buttes",
    description: "Wind-eroded sandstone buttes at the entrance to Mount Sharp (2016).",
    traverseDistance: "\u2248 14.1 km along the traverse",
    traverseKm: 14.1,
    basePath: "/eva/gale/murray_buttes",
    pois: [
      { id: "mb1", title: "Buttes", text: "These are the Murray Buttes. Buttes are steep, knob-like rock formations. The largest one here is about as tall as a three-story building. These buttes served as Curiosity's entryway to its main destination: Mount Sharp.", image: "/eva/cards/mb1.jpg", position: [13.8, 1.2, 6.9], weight: 0.7 },
      { id: "mb2", title: "Bruce Murray", text: "The Murray Buttes are named after the late Bruce Murray, a Caltech planetary scientist and director of NASA's Jet Propulsion Laboratory. He worked on NASA's first missions to Mars and laid the groundwork for future Mars exploration.", image: "/eva/cards/mb2.jpg", position: [-10.56, 1.8, -12.9], weight: 0.3 },
      { id: "mb3", title: "Monument Valley", text: "These buttes are similar to ones you'd find on Earth, formed when wind erodes ancient sandstone. Scientists have compared the region to Monument Valley.", image: "/eva/cards/mb3.jpg", position: [21.0, 6.2, 3.7], weight: 0.6 },
      { id: "mb4", title: "Interference", text: "The buttes are beautiful, but are sometimes tall enough to block the signal between Curiosity and the Mars orbiters that fly overhead. That can temporarily reduce the amount of data that Curiosity can send back to Earth.", image: "/eva/cards/mb4.jpg", position: [-63.5, -3.9, 35.2], weight: 0.3 },
    ],
  },
];

export const GALE_REFERENCE = { lat: -4.5895, lon: 137.4417, name: "Gale crater (Curiosity landing site)" } as const;
