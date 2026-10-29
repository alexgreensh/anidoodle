// TEST FIXTURE for tools/ship.mjs (src/canvas-core/fixtureShip.ts): four checks cannot look, so ship must FAIL it.
import { fixtureShipBlind } from "../canvas-core/fixtureShipBlind";
import { mountFilm } from "./page";

mountFilm(fixtureShipBlind);
