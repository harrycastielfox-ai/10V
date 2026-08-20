export default {
  fetch(request) {
    const url = new URL(request.url);
    url.hostname = "livrodecontas.sipi-dt-itabela.workers.dev";

    if (url.pathname === "/alias") {
      url.pathname = "/";
    }

    return Response.redirect(url.toString(), 301);
  },
};
