/*jshint esversion: 10 */
const pointsMap = new Map();
let updatingTSpans = false;
let eventTimeout;
let deleted = new Set();
let unknownAmount = false;

function adjustYValue() {
    const paths = document.querySelectorAll("path");

    paths.forEach((path) => {
        const dValue = path.getAttribute("d");

        if (dValue && dValue.includes("m -6, 0")) {
            const thirdSpaceIndex = dValue.split(" ", 3)
                .join(" ")
                .length;
            const mCommand = dValue.slice(0, thirdSpaceIndex);
            const mCommandParts = mCommand.split(" ");
            unknownAmount = false;

            try {
                const x = Math.round(parseFloat(mCommandParts[1].slice(0, -1)));
                mCommandParts[2] = pointsMap.get(x)
                    .toString() + "\n";
                if (deleted.has(x)) {
                    unknownAmount = true;
                }
            } catch {
                setTimeout(function () {
                    adjustYValue();
                }, 100);
            }

            path.setAttribute("d", mCommandParts.join(" ") + dValue.slice(thirdSpaceIndex));
        }
    });
}

function updateTSpans() {
    updatingTSpans = true;

    const date = document.querySelector("#chart-undefined-6-title-all tspan");
    const amount = document.querySelector("#chart-undefined-6-labels-0 tspan");

    let amountTextContent = "";

    if (date && amount) {
        if (amount.textContent != "unknown") {
            let i = amount.textContent.length - 1;
            let found = false;
            while (!found) {
                const c = amount.textContent[i];
                amountTextContent = c + amountTextContent;
                if (c == "$") {
                    found = true;
                    break;
                }
                i--;
            }
            amount.textContent = "";
        }
    } else {
        setTimeout(function () {
            updateTSpans();
            adjustYValue();
        }, 100);
        updatingTSpans = false;
        return;
    }
    amount.textContent = amountTextContent;
    if (unknownAmount) {
        amount.textContent = "unknown";
    }

    updatingTSpans = false;
}

function filterPathData(d) {
    const points = d.split("L");
    const filteredPoints = [];
    let [x, y] = points[0].slice(1)
        .split(",")
        .map(Number);
    let initMin, initMax, keptMin, keptMax;
    initMin = initMax = keptMin = keptMax = y;
    filteredPoints.push([x, y]);
    [x, y] = points[1].split(",")
        .map(Number);
    if (y < initMin) {
        initMin = keptMin = y;
    } else if (y > initMax) {
        initMax = keptMax = y;
    }
    filteredPoints.push([x, y]);

    for (let i = 2; i < points.length; i++) {
        const [x2, y2] = points[i].split(",")
            .map(Number);
        const [x1, y1] = filteredPoints[filteredPoints.length - 1];
        const y0 = filteredPoints[filteredPoints.length - 2][1];

        const yChangeCurrent = ((y2 - y1) / y1);
        const yChangePrev = ((y1 - y0) / y0);

        if (y2 < initMin) {
            initMin = y2;
        } else if (y2 > initMax) {
            initMax = y2;
        }

        if ((Math.abs(yChangeCurrent) > 0.25 && Math.abs(yChangePrev) > 0.25)) {
            deleted.add(Math.round(filteredPoints.pop()[0]));
            filteredPoints.push([x1, y0]);
        } else if (i > 3) {
            if (keptMin == null) {
                keptMin = y1;
                keptMax = y1;
            } else if (y1 < keptMin) {
                keptMin = y1;
            } else if (y1 > keptMax) {
                keptMax = y1;
            }
        }

        filteredPoints.push([x2, y2]);
    }

    const yFinal = filteredPoints[filteredPoints.length - 1][1];
    if (yFinal < keptMin) {
        keptMin = yFinal;
    } else if (yFinal > keptMax) {
        keptMax = yFinal;
    }

    const scale = (initMax - initMin) / (keptMax - keptMin);

    const pathSegments = [];
    x = filteredPoints[0][0];
    const yPrime = (filteredPoints[0][1] - keptMin) * scale + initMin;
    pathSegments.push(`M${x},${yPrime}`);
    pointsMap.clear();
    pointsMap.set(Math.round(x), yPrime);
    pathSegments.push("L");
    for (let i = 1; i < filteredPoints.length; i++) {
        const [x, y] = filteredPoints[i];
        const yPrime = (y - keptMin) * scale + initMin;
        pathSegments.push(`${x},${yPrime}`);
        pointsMap.set(Math.round(x), yPrime);
        if (i < filteredPoints.length - 1) {
            pathSegments.push("L");
        }
    }

    return pathSegments.join("");
}

function processTargetedPaths() {
    const groups = document.querySelectorAll('g[clip-path="url(#victory-clip-2)"]');

    if (groups.length > 0) {
        groups.forEach((group) => {
            group.querySelectorAll("path")
                .forEach((path) => {
                    const dValue = path.getAttribute("d");
                    if (dValue) {
                        const filteredValue = filterPathData(dValue);
                        path.setAttribute("d", filteredValue);
                    }
                });
        });
    }

}

function handleButtonClick() {
    setTimeout(function () {
        processTargetedPaths();
        adjustYValue();
        updateTSpans();
    }, 100);
}

function handleEvent() {
    if (!updatingTSpans) {
        adjustYValue();
        updateTSpans();
    }
    if (eventTimeout) {
        clearTimeout(eventTimeout);
    }
    eventTimeout = setTimeout(() => {
        handleEvent();
    }, 250);
}

const observer = new MutationObserver(mutations => {
    mutations.forEach((mutation) => {
        if (mutation.type === "childList") {
            handleChildListMutations(mutation);
        } else if (mutation.type === "attributes" && mutation.attributeName === "d") {
            handleAttributeMutations(mutation);
        }
    });
});

function handleChildListMutations(mutation) {
    mutation.addedNodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE) {
            processAddedNodes(node);
        }
    });
}

function handleAttributeMutations(mutation) {
    const target = mutation.target;
    if (target.nodeName === "PATH") {
        const newValue = target.getAttribute("d");
        if (newValue) {
            const filteredValue = filterPathData(newValue);
            target.setAttribute("d", filteredValue);
        }
    }
}

function processAddedNodes(node) {
    const groups = node.querySelectorAll('g[clip-path="url(#victory-clip-2)"]');
    if (groups.length > 0) {
        processTargetedPaths();
    }

    const paths = node.querySelectorAll("path");
    if (paths.length > 0) {
        adjustYValue();
    }

    const buttons = node.querySelectorAll("button");
    buttons.forEach((button) => {
        button.addEventListener("click", handleButtonClick);
    });

    const svg = node.querySelectorAll("svg");
    svg.forEach((img) => {
        img.addEventListener("mousemove", handleEvent);
    });
}

observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true
});