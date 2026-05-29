// Storage case-study page ("leave room for the work" — offline last mile).
// Served at "/casestudy". Like demo-page.ts, the page is a real .html file
// imported as a text string so there is nothing to escape.
import html from "./demo-casestudy.html" with { type: "text" };

export const DEMO_CASESTUDY_HTML: string = html as unknown as string;
