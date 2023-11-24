let N = "1";
let E = "1";
let S = "-1";
let W = "-1";
let OSM_URL = `https://www.openstreetmap.org/history?list=1&bbox=${W}%2C${S}%2C${E}%2C${N}`;
let NEARBY_LIMIT = 1;

const XML_STRING = `<!--?xml version="1.0" encoding="UTF-8"?-->`;

function makeAnEntry(id, time, author, authoruri, link, title, summary){
    return `<entry><id>tag:history.openstreetmap.org,2021:${id}</id>
    <updated>${time}</updated>
    <author>
      <name>${author}</name>
      <uri>${authoruri}</uri>
    </author>
    <link rel="alternate" type="text/html" href="${link}"></link>
    <title>${title}</title>
    <summary type="html"><![CDATA[${summary}]]></summary>
    </entry>`;
}

function removeXMLChars(input){
    return input.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;").replace("'", "&apos;");
}

function downloadPage(xml){
    const textfile = new File([xml], "osmhist.atom", {type: "text/atom"});
    chrome.downloads.download({
        url: window.URL.createObjectURL(textfile),
        filename: "osmhist.atom",
        conflictAction: "overwrite",
        saveAs: false
    });
    // download was started. does not mean it completed.
    const today = new Date().getDay();
    chrome.storage.local.set({"lastrun": today});
}

function cleanHTML(raw){
    // relative URLs break the feed generation
    return raw.replaceAll(`="/`, `="https://www.openstreetmap.org/`).replaceAll(`url("&quot;/`, `url(&quot;https://www.openstreetmap.org)`);
}

function makeBoxSummary(minlong, minlat, maxlong, maxlat){
    const fminlong = parseFloat(minlong);
    const fminlat = parseFloat(minlat);
    const fmaxlong = parseFloat(maxlong);
    const fmaxlat = parseFloat(maxlat);
    const fW = parseFloat(W);
    const fN = parseFloat(N);
    const fE = parseFloat(E);
    const fS = parseFloat(S);
    return `<p>Changeset relative to target area:
    <ul>
        <li>W: ${minlong} (relative by ${fminlong - fW})</li>
        <li>N: ${minlat} (relative by ${fminlat - fN})</li>
        <li>E: ${maxlong} (relative by ${fmaxlong - fE})</li>
        <li>S: ${maxlat} (relative by ${fmaxlat - fS})</li>
    </ul>`
}

function isWithinArea(minlong, minlat, maxlong, maxlat){
    const fminlong = parseFloat(minlong);
    const fminlat = parseFloat(minlat);
    const fmaxlong = parseFloat(maxlong);
    const fmaxlat = parseFloat(maxlat);
    const fW = parseFloat(W);
    const fN = parseFloat(N);
    const fE = parseFloat(E);
    const fS = parseFloat(S);
    const dW = Math.abs(fminlong - fW);
    const dN = Math.abs(fminlat - fN);
    const dE = Math.abs(fmaxlong - fE);
    const dS = Math.abs(fmaxlat - fS);
    return dW < NEARBY_LIMIT && dN < NEARBY_LIMIT && dE < NEARBY_LIMIT && dS < NEARBY_LIMIT;
}

function extractEventsArray(body){
    const div = document.createElement("div");
    div.innerHTML = body;
    const events = Array.from(div.querySelectorAll("li"));
    const eventData = events.map(event => {
        const timeel = event.querySelector("time"); // <time title="Created: Fri, 24 Nov 2023 11:21:37 +0000        Closed: Fri, 24 Nov 2023 11:21:39 +0000" datetime="2023-11-24T11:21:39Z">about 5 hours ago</time>
        const authorel = event.querySelector("div a"); // <a href="/user/blah">Blah</a>
        const pageel = event.querySelector("p a"); // <a class="changeset_id text-dark" href="/changeset/nnnnnnnnn">Changeset description</a>
        //                                                                  0  1        2      3   4     5         6         7       8           9       10        11        12
        const latlong = event.getAttribute("data-changeset").split("\""); // {"id":111641913,"bbox":{"minlon":-4.4953485,"minlat":54.9145997,"maxlon":-1.4070896,"maxlat":56.4630365}}
        minlong = latlong[6].replace(":", "").replace(",", "");
        minlat = latlong[8].replace(":", "").replace(",", "");
        maxlong = latlong[10].replace(":", "").replace(",", "");
        maxlat = latlong[12].replace(":", "").replace(",", "").replace("}}", "");
        return {
            isWithinArea: isWithinArea(minlong, minlat, maxlong, maxlat),
            id: event.id,
            time: timeel.datetime,
            authorid: authorel.href.split("/")[2],
            author: removeXMLChars(authorel.innerText),
            url: pageel.href,
            title: removeXMLChars(pageel.innerText),
            content: event.innerHTML + makeBoxSummary(minlong, minlat, maxlong, maxlat) // HTML
        };
    });
    return eventData.filter(a => a.isWithinArea);
}

function createInMemoryPage(data){
    const head = XML_STRING +`
    <feed xmlns="http://www.w3.org/2005/Atom" xml:lang="en">
        <id>tag:history.openstreetmap.org,2021:feed/history.openstreetmap.org</id>
        <title>OSM History Atom User Feed</title>
        <icon>https://www.openstreetmap.org/favicon.ico</icon>
        <subtitle>A OSM history report for a given region as an Atom feed</subtitle>
        <logo>https://www.openstreetmap.org/assets/apple-touch-icon-114x114-20ba9df1a8f9b341040d661b7942b7b10288b9b4c4ce0663e10018958dc7f4a8.png</logo>`;
    let body = `<updated>`+new Date().toISOString()+`</updated>`;
    data.forEach(post => {
        body += "\n" + makeAnEntry(post.id, post.time, post.author, post.authorid, post.url, post.title, post.content);
    });
    const tail = `</feed>`;
    return head + body + tail;
}

function workInBackground(){
    chrome.storage.local.get({"lastrun": 99999999, "w":-1, "n":1, "e":1, "s":-1, "lim":1}, details => {
        const lastrun = details["lastrun"];
        const today = new Date().getDay();
        W = details["w"];
        N = details["n"];
        E = details["e"];
        S = details["s"];
        OSM_URL = `https://www.openstreetmap.org/history?list=1&bbox=${W}%2C${S}%2C${E}%2C${N}`;
        NEARBY_LIMIT = details["lim"];
        console.log("Running. Last: " + lastrun + " today: " + today);
        // don't run if it already ran today
        if(today !== lastrun) {
            fetch(OSM_URL)
            .then(response => response.blob())
            .then(blob => blob.text())
            .then(cleanHTML)
            .then(extractEventsArray)
            .then(createInMemoryPage)
            .then(downloadPage);
        } else {
            // an alarm? I'm assuming i don't keep my browser opne all the time...
        }
    });
}

// else running in background page
chrome.runtime.onStartup.addListener(workInBackground);
chrome.runtime.onInstalled.addListener(workInBackground);
