/**
 * Make sure not to include any deps from our main index file. That way, we can easily publish the publin as standalone build
 */
import { Plugin } from "../";
import Yasr from "../../";
import { addClass } from "@matdata/yasgui-utils";
import "./index.scss";

export default class Error implements Plugin<never> {
  private yasr: Yasr;
  constructor(yasr: Yasr) {
    this.yasr = yasr;
  }
  canHandleResults() {
    return !!this.yasr.results && !!this.yasr.results.getError();
  }
  private getTryBtn(link: string) {
    const tryBtn = document.createElement("a");
    tryBtn.href = link;
    tryBtn.rel = "noopener noreferrer";
    tryBtn.target = "_blank";
    tryBtn.className = "yasr_tryQuery";
    tryBtn.textContent = "Try query in a new browser window";
    return tryBtn;
  }
  private getCorsMessage() {
    const corsEl = document.createElement("div");
    corsEl.className = "redOutline";
    const mainMsg = document.createElement("p");
    mainMsg.textContent = "Unable to get response from endpoint. Possible reasons:";
    corsEl.appendChild(mainMsg);

    const list = document.createElement("ul");
    const incorrectEndpoint = document.createElement("li");
    incorrectEndpoint.textContent = "Incorrect endpoint URL";
    list.appendChild(incorrectEndpoint);

    const endpointDown = document.createElement("li");
    endpointDown.textContent = "Endpoint is down";
    list.appendChild(endpointDown);

    const credExpired = document.createElement("li");
    credExpired.textContent = "Credentials have expired";
    list.appendChild(credExpired);

    const cors = document.createElement("li");
    const firstPart = document.createElement("span");
    firstPart.textContent = "Endpoint is not accessible from the Matgui server and website, and the endpoint is not ";
    cors.appendChild(firstPart);
    const secondPart = document.createElement("a");
    secondPart.textContent = "CORS-enabled";
    secondPart.href = "http://enable-cors.org/";
    secondPart.target = "_blank";
    secondPart.rel = "noopener noreferrer";
    cors.appendChild(secondPart);
    list.appendChild(cors);

    corsEl.appendChild(list);
    return corsEl;
  }

  private getStatusSpecificGuidance(status: number): HTMLElement | null {
    const guidanceEl = document.createElement("div");
    guidanceEl.className = "statusGuidance";

    const title = document.createElement("h4");
    const suggestions = document.createElement("ul");

    switch (status) {
      case 401:
        title.textContent = "Authentication Required";
        guidanceEl.appendChild(title);

        const auth1 = document.createElement("li");
        auth1.textContent = "The endpoint requires authentication credentials";
        suggestions.appendChild(auth1);

        const auth2 = document.createElement("li");
        auth2.textContent = "Check if you need to provide an API key, username/password, or bearer token";
        suggestions.appendChild(auth2);

        const auth3 = document.createElement("li");
        auth3.textContent = "Verify your credentials are correct and not expired";
        suggestions.appendChild(auth3);

        guidanceEl.appendChild(suggestions);
        return guidanceEl;

      case 403:
        title.textContent = "Access Forbidden";
        guidanceEl.appendChild(title);

        const forbidden1 = document.createElement("li");
        forbidden1.textContent = "You don't have permission to access this endpoint";
        suggestions.appendChild(forbidden1);

        const forbidden2 = document.createElement("li");
        forbidden2.textContent = "Your credentials may be valid but lack sufficient privileges";
        suggestions.appendChild(forbidden2);

        const forbidden3 = document.createElement("li");
        forbidden3.textContent = "Contact the endpoint administrator to request access";
        suggestions.appendChild(forbidden3);

        const forbidden4 = document.createElement("li");
        forbidden4.textContent =
          "A firewall such as OWASP is blocking is blocking SPARQL queries because they resemble SQL injection attempts. Contact the endpoint administrator to whitelist your queries or adjust firewall settings";
        suggestions.appendChild(forbidden4);

        guidanceEl.appendChild(suggestions);
        return guidanceEl;

      case 404:
        title.textContent = "Endpoint Not Found";
        guidanceEl.appendChild(title);

        const notFound1 = document.createElement("li");
        notFound1.textContent = "The endpoint URL may be incorrect or has changed";
        suggestions.appendChild(notFound1);

        const notFound2 = document.createElement("li");
        notFound2.textContent = "Check for typos in the endpoint address";
        suggestions.appendChild(notFound2);

        const notFound3 = document.createElement("li");
        notFound3.textContent = "Verify the endpoint is still active and hasn't been moved";
        suggestions.appendChild(notFound3);

        guidanceEl.appendChild(suggestions);
        return guidanceEl;

      case 429:
        title.textContent = "Too Many Requests";
        guidanceEl.appendChild(title);

        const rateLimit1 = document.createElement("li");
        rateLimit1.textContent = "You've exceeded the rate limit for this endpoint";
        suggestions.appendChild(rateLimit1);

        const rateLimit2 = document.createElement("li");
        rateLimit2.textContent = "Wait a few moments before trying again";
        suggestions.appendChild(rateLimit2);

        const rateLimit3 = document.createElement("li");
        rateLimit3.textContent =
          "Consider reducing query frequency or contacting the endpoint provider for higher limits";
        suggestions.appendChild(rateLimit3);

        guidanceEl.appendChild(suggestions);
        return guidanceEl;

      case 500:
        title.textContent = "Internal Server Error";
        guidanceEl.appendChild(title);

        const server1 = document.createElement("li");
        server1.textContent = "The SPARQL endpoint encountered an error while processing your query";
        suggestions.appendChild(server1);

        const server2 = document.createElement("li");
        server2.textContent = "Try simplifying your query or reducing the result limit";
        suggestions.appendChild(server2);

        const server3 = document.createElement("li");
        server3.textContent = "Check the error message below for specific details";
        suggestions.appendChild(server3);

        const server4 = document.createElement("li");
        server4.textContent = "If the problem persists, contact the endpoint administrator";
        suggestions.appendChild(server4);

        guidanceEl.appendChild(suggestions);
        return guidanceEl;

      case 502:
      case 503:
      case 504:
        title.textContent = status === 502 ? "Bad Gateway" : status === 503 ? "Service Unavailable" : "Gateway Timeout";
        guidanceEl.appendChild(title);

        const gateway1 = document.createElement("li");
        gateway1.textContent = "The endpoint is temporarily unavailable or overloaded";
        suggestions.appendChild(gateway1);

        const gateway2 = document.createElement("li");
        gateway2.textContent = "Try again in a few moments";
        suggestions.appendChild(gateway2);

        const gateway3 = document.createElement("li");
        gateway3.textContent = "The service may be undergoing maintenance";
        suggestions.appendChild(gateway3);

        guidanceEl.appendChild(suggestions);
        return guidanceEl;

      default:
        // For other 4xx errors
        if (status >= 400 && status < 500) {
          title.textContent = "Client Error";
          guidanceEl.appendChild(title);

          const client1 = document.createElement("li");
          client1.textContent = "There's an issue with the request";
          suggestions.appendChild(client1);

          const client2 = document.createElement("li");
          client2.textContent = "Check the error message below for details";
          suggestions.appendChild(client2);

          guidanceEl.appendChild(suggestions);
          return guidanceEl;
        }
        return null;
    }
  }
  async draw() {
    const el = document.createElement("div");
    el.className = "errorResult";
    this.yasr.resultsEl.appendChild(el);

    const error = this.yasr.results?.getError();
    if (!error) return;
    const header = document.createElement("div");
    header.className = "errorHeader";
    el.appendChild(header);

    // Try whether a custom rendering of the error exists
    const newMessage = await this.yasr.renderError(error);
    if (newMessage) {
      const customMessage = document.createElement("div");
      customMessage.className = "redOutline";
      customMessage.appendChild(newMessage);
      el.appendChild(customMessage);
      return;
    }

    // No custom rendering? Let's render it ourselves!
    if (error.status) {
      var statusText = "Error";
      if (error.statusText && error.statusText.length < 100) {
        //use a max: otherwise the alert span will look ugly
        statusText = error.statusText;
      }
      statusText += ` (#${error.status})`;
      const statusTextEl = document.createElement("span");
      statusTextEl.className = "status";
      statusTextEl.textContent = statusText;

      header.appendChild(statusTextEl);
      if (this.yasr.config.getPlainQueryLinkToEndpoint) {
        const link = this.yasr.config.getPlainQueryLinkToEndpoint();
        if (link) header.appendChild(this.getTryBtn(link));
      }

      // Add status-specific guidance
      const guidance = this.getStatusSpecificGuidance(error.status);
      if (guidance) {
        el.appendChild(guidance);
      }

      if (error.text) {
        const textContainer = document.createElement("div");
        addClass(textContainer, "errorMessageContainer");
        el.appendChild(textContainer);
        const errTextEl = document.createElement("pre");
        addClass(errTextEl, "errorMessage");
        errTextEl.textContent = error.text;
        textContainer.appendChild(errTextEl);
      }
    } else {
      if (this.yasr.config.getPlainQueryLinkToEndpoint) {
        const link = this.yasr.config.getPlainQueryLinkToEndpoint();
        if (link) header.appendChild(this.getTryBtn(link));
      }
      // Only show CORS message for network failures (not for HTTP errors with status codes)
      // Common network error indicators: terminated requests, fetch failures, no error text
      const isNetworkError =
        !error.text ||
        error.text.indexOf("Request has been terminated") >= 0 ||
        error.text.indexOf("Failed to fetch") >= 0 ||
        error.text.indexOf("NetworkError") >= 0 ||
        error.text.indexOf("Network request failed") >= 0;

      if (isNetworkError) {
        el.appendChild(this.getCorsMessage());
      } else {
        const errTextEl = document.createElement("pre");
        errTextEl.textContent = error.text;
        el.appendChild(errTextEl);
      }
    }
  }
  getIcon() {
    return document.createElement("");
  }
  priority = 20;
  hideFromSelection = true;
}
