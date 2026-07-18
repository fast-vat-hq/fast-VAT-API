/**
 * One-off helper: check which candidate demo IPs resolve to the expected
 * country in the local GeoLite2 database, so the tester UI's location
 * simulator only offers IPs that actually work.
 */
import { getCountryFromIp } from "../src/geo.js";

const candidates: ReadonlyArray<readonly [string, string]> = [
  ["SE", "193.15.240.60"],
  ["DK", "193.162.145.1"],
  ["NO", "193.213.112.4"],
  ["FI", "193.166.4.24"],
  ["IS", "157.157.0.1"],
  ["DE", "194.25.2.129"],
  ["FR", "194.2.0.20"],
  ["NL", "194.109.6.66"],
  ["BE", "195.238.2.21"],
  ["LU", "158.64.1.1"],
  ["AT", "195.3.96.67"],
  ["IE", "159.134.0.1"],
  ["IT", "151.99.125.2"],
  ["ES", "194.224.52.36"],
  ["PT", "195.22.0.1"],
  ["PL", "194.204.159.1"],
  ["CZ", "193.165.208.1"],
  ["HU", "195.228.240.1"],
  ["GR", "195.170.0.1"],
  ["RO", "193.231.236.1"],
  ["BG", "195.34.96.1"],
  ["HR", "161.53.0.1"],
  ["SI", "193.2.1.66"],
  ["SK", "195.146.128.1"],
  ["EE", "195.80.100.1"],
  ["LV", "159.148.0.1"],
  ["LT", "193.219.32.1"],
  ["CY", "195.14.128.1"],
  ["MT", "195.158.64.1"],
  ["GB", "212.58.244.20"],
  ["US", "8.8.8.8"],
  ["CH", "130.59.31.80"],
];

let ok = 0;
for (const [expected, ip] of candidates) {
  const actual = getCountryFromIp(ip);
  const status = actual === expected ? "OK  " : "MISS";
  if (actual === expected) ok += 1;
  console.log(`${status} ${expected} ${ip} -> ${actual ?? "null"}`);
}
console.log(`\n${ok}/${candidates.length} verified`);
