import argparse
import os
import random
DEFAULT_MAX_CARDS = 750  # drawasaurus seems to crash with any more words
DEFAULT_NUM_CHARS = 20  # cards get really hard to guess past this


def main(num_chars, max_cards, wl=None, bl=None):
    white_cards = []
    if wl:
        wl = [w.lower() for w in wl]
    if bl:
        bl = [b.lower() for b in bl]
    for deck_dir in os.listdir('src/'):
        if wl is not None:
            if deck_dir.lower() not in wl:
                print(f"Skipping deck {deck_dir}, not in whitelist")
                continue
        if bl is not None:
            if deck_dir.lower() in bl:
                print(f"Skipping deck {deck_dir}, in blacklist")
                continue
        with open('src/' + deck_dir + '/white.md.txt') as f:
            cards = [c.strip() for c in f.readlines()]
            # Remove trailing period
            cards = [c[0:-1] if c.endswith('.') else c for c in cards]

            # Remove cards that are too long or have punctuation
            cards = [
                c for c in cards if (
                    len(c) <= num_chars and
                    all([w.isalnum() for w in c.split()]))]
            white_cards.extend(cards)

    unique_white = list(set(white_cards))
    random.shuffle(unique_white)
    unique_white = unique_white[0:max_cards]

    with open('drawasaurus.txt', 'w') as lb:
        lb.write("\n".join(unique_white))
    print("##### OUTPUT BEGIN #####\n")
    print(",".join(unique_white))
    print("\n##### OUTPUT END #####")
    print("Output written to drawasaurus.txt")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Generate a custom wordlist for drawasaurus")
    parser.add_argument("-w", "--whitelist", nargs="+",
        help="Space separated list of decks to whitelist")
    parser.add_argument("-b", "--blacklist", nargs="+",
        help="Space separated list of decks to blacklist")
    parser.add_argument("-n", "--numchars", type=int, default=DEFAULT_NUM_CHARS,
        help="Max number of characters per card")
    parser.add_argument("-m", "--maxcards", type=int, default=DEFAULT_MAX_CARDS,
        help="Number of cards to choose")
    args = parser.parse_args()
    main(args.numchars, args.maxcards, wl=args.whitelist, bl=args.blacklist)
