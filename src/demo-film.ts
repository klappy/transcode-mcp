// Film demo page (scroll-driven Showroom -> In-Context -> Race).
// Served at "/" and "/film". Like demo-page.ts, the page is a real .html file
// imported as a text string so there is nothing to escape.
import html from "./demo-film.html" with { type: "text" };

export const DEMO_FILM_HTML: string = html as unknown as string;
