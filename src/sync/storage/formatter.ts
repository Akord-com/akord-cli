export default function formatStorage (bytes: number, decimals = 2) {
    if (bytes === 0 || !bytes) return "0 b";
    const k = 1000;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ["b", "kb", "mb", "gb", "tb", "pb", "eb", "zb", "yb"];

    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i].toUpperCase()}`
};
