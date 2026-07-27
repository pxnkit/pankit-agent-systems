import handler from "vinext/server/app-router-entry";

/**
 * The portfolio does not require database or image-transformation bindings.
 * vinext owns the App Router request handler and emits the deployable Worker.
 */
export default handler;
