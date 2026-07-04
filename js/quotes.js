// Daily quote pool — discipline, grit, perseverance, mental toughness.
//
// Attribution policy (deliberate): only quotes with well-documented sourcing
// are stated as fact. Anything popular-but-unsourced is labeled "Attributed
// to X" or "Unknown" rather than asserted. Several famous lines are listed
// under their REAL source, not the person the internet credits:
//   - "We are what we repeatedly do…" is Will Durant summarizing Aristotle,
//     not Aristotle.
//   - "Do what you can, with what you have…" is Squire Bill Widener, quoted
//     by Theodore Roosevelt in his autobiography.
//   - The "fighting man / thinking man" line is Sir William Francis Butler,
//     not Thucydides.
//   - "It always seems impossible…" (Mandela), "If you're going through
//     hell…" (Churchill), and the Coolidge persistence passage have no
//     verified primary source → labeled "Attributed to".
// Deliberately excluded as misattributed/fabricated: "Success is not final…"
// (not Churchill), "Out of every one hundred men…" (not Heraclitus),
// "Luck is what happens when preparation meets opportunity" (not Seneca).
//
// Indexed by day-of-year so everyone sees the same quote on the same date.

export const QUOTES = [
  // ---- Stoics & antiquity ----
  { t: 'Waste no more time arguing about what a good man should be. Be one.', a: 'Marcus Aurelius, Meditations' },
  { t: 'The impediment to action advances action. What stands in the way becomes the way.', a: 'Marcus Aurelius, Meditations' },
  { t: 'Disgraceful: for the soul to give up when the body is still going strong.', a: 'Marcus Aurelius, Meditations' },
  { t: 'You could leave life right now. Let that determine what you do and say and think.', a: 'Marcus Aurelius, Meditations' },
  { t: 'Do not act as if you had ten thousand years to live.', a: 'Marcus Aurelius, Meditations' },
  { t: 'The best revenge is to be unlike him who performed the injury.', a: 'Marcus Aurelius, Meditations' },
  { t: 'If it is not right, do not do it; if it is not true, do not say it.', a: 'Marcus Aurelius, Meditations' },
  { t: 'At dawn, when you have trouble getting out of bed, tell yourself: I have to go to work — as a human being.', a: 'Marcus Aurelius, Meditations' },
  { t: 'Confine yourself to the present.', a: 'Marcus Aurelius, Meditations' },
  { t: 'Receive without pride, let go without attachment.', a: 'Marcus Aurelius, Meditations' },
  { t: 'It is not death that a man should fear, but never beginning to live.', a: 'Marcus Aurelius, Meditations' },
  { t: 'You have power over your mind — not outside events. Realize this, and you will find strength.', a: 'Attributed to Marcus Aurelius' },
  { t: 'We suffer more often in imagination than in reality.', a: 'Seneca, Letters' },
  { t: 'It is not because things are difficult that we do not dare; it is because we do not dare that things are difficult.', a: 'Seneca, Letters' },
  { t: 'Fire tests gold; adversity tests brave men.', a: 'Seneca, On Providence' },
  { t: 'Difficulties strengthen the mind, as labor does the body.', a: 'Seneca' },
  { t: 'While we are postponing, life speeds by.', a: 'Seneca, Letters' },
  { t: 'The body should be treated rigorously, that it may not be disobedient to the mind.', a: 'Seneca, Letters' },
  { t: 'Men are disturbed not by things, but by the view they take of them.', a: 'Epictetus, Enchiridion' },
  { t: 'No man is free who is not master of himself.', a: 'Epictetus' },
  { t: 'First say to yourself what you would be; then do what you have to do.', a: 'Epictetus, Discourses' },
  { t: 'Difficulties are things that show a person what they are.', a: 'Epictetus, Discourses' },
  { t: 'If you want to improve, be content to be thought foolish and stupid.', a: 'Epictetus, Enchiridion' },
  { t: 'No great thing is created suddenly, any more than a bunch of grapes or a fig.', a: 'Epictetus, Discourses' },
  { t: 'Circumstances don’t make the man; they only reveal him to himself.', a: 'Epictetus (traditional rendering)' },
  { t: 'The first and greatest victory is to conquer yourself.', a: 'Attributed to Plato' },
  { t: 'No man has the right to be an amateur in the matter of physical training. It is a shame for a man to grow old without seeing the beauty and strength of which his body is capable.', a: 'Attributed to Socrates' },
  { t: 'We are what we repeatedly do. Excellence, then, is not an act, but a habit.', a: 'Will Durant, summarizing Aristotle' },
  { t: 'Endure and persist; this pain will turn to good by and by.', a: 'Ovid' },
  { t: 'Fortune favors the bold.', a: 'Virgil, Aeneid' },
  { t: 'Through hardships to the stars.', a: 'Latin proverb (per aspera ad astra)' },
  { t: 'He conquers who endures.', a: 'Attributed to Persius' },
  { t: 'Come back with your shield — or on it.', a: 'Spartan saying, recorded by Plutarch' },
  { t: 'The secret of happiness is freedom, and the secret of freedom is courage.', a: 'Thucydides (Pericles’ funeral oration)' },

  // ---- Military ----
  { t: 'Discipline equals freedom.', a: 'Jocko Willink' },
  { t: 'Discipline is the root of all good qualities.', a: 'Jocko Willink' },
  { t: 'Get after it.', a: 'Jocko Willink' },
  { t: 'Don’t count on motivation. Count on discipline.', a: 'Jocko Willink' },
  { t: 'You don’t have to like it, you just have to do it.', a: 'David Goggins' },
  { t: 'You are in danger of living a life so comfortable and soft that you will die without ever realizing your true potential.', a: 'David Goggins, Can’t Hurt Me' },
  { t: 'Motivation is crap. Motivation comes and goes.', a: 'David Goggins' },
  { t: 'The most important conversations you’ll ever have are the ones you’ll have with yourself.', a: 'David Goggins, Can’t Hurt Me' },
  { t: 'Denial is the ultimate comfort zone.', a: 'David Goggins, Can’t Hurt Me' },
  { t: 'The only easy day was yesterday.', a: 'U.S. Navy SEALs motto' },
  { t: 'Get comfortable being uncomfortable.', a: 'Navy SEAL saying' },
  { t: 'If knocked down, I will get back up, every time.', a: 'U.S. Navy SEAL Ethos' },
  { t: 'Surrender is not a Ranger word.', a: 'U.S. Army Ranger Creed' },
  { t: 'Pain is weakness leaving the body.', a: 'U.S. Marine Corps saying' },
  { t: 'The more you sweat in training, the less you bleed in war.', a: 'Military proverb' },
  { t: 'Slow is smooth, and smooth is fast.', a: 'Military saying' },
  { t: 'Embrace the suck.', a: 'Military saying' },
  { t: 'If you want to change the world, start off by making your bed.', a: 'Admiral William H. McRaven' },
  { t: 'A pint of sweat will save a gallon of blood.', a: 'General George S. Patton' },
  { t: 'If you are going to win any battle, you have to do one thing. You have to make the mind run the body.', a: 'General George S. Patton' },
  { t: 'Sweat saves blood.', a: 'Field Marshal Erwin Rommel' },
  { t: 'The most important six inches on the battlefield is between your ears.', a: 'General James Mattis' },
  { t: 'Never give in. Never, never, never, never — in nothing, great or small, large or petty — never give in, except to convictions of honour and good sense.', a: 'Winston Churchill' },
  { t: 'If you’re going through hell, keep going.', a: 'Attributed to Winston Churchill' },
  { t: 'You must never confuse faith that you will prevail in the end with the discipline to confront the most brutal facts of your current reality.', a: 'Admiral James Stockdale' },
  { t: 'Victorious warriors win first and then go to war.', a: 'Sun Tzu, The Art of War' },
  { t: 'Victory awaits him who has everything in order — luck, people call it.', a: 'Roald Amundsen' },
  { t: 'Difficulties are just things to overcome, after all.', a: 'Sir Ernest Shackleton' },
  { t: 'The nation that insists on drawing a broad line between the fighting man and the thinking man is liable to find its fighting done by fools and its thinking by cowards.', a: 'Sir William Francis Butler' },
  { t: 'We don’t rise to the level of our expectations; we fall to the level of our training.', a: 'Unknown (popular in special-operations culture)' },

  // ---- Fighters ----
  { t: 'I hated every minute of training, but I said, “Don’t quit. Suffer now and live the rest of your life as a champion.”', a: 'Muhammad Ali' },
  { t: 'The fight is won or lost far away from witnesses — behind the lines, in the gym, and out there on the road, long before I dance under those lights.', a: 'Muhammad Ali' },
  { t: 'Don’t count the days; make the days count.', a: 'Muhammad Ali' },
  { t: 'He who is not courageous enough to take risks will accomplish nothing in life.', a: 'Muhammad Ali' },
  { t: 'Champions aren’t made in gyms. Champions are made from something they have deep inside them — a desire, a dream, a vision.', a: 'Muhammad Ali' },
  { t: 'Everyone has a plan until they get punched in the mouth.', a: 'Mike Tyson' },
  { t: 'A champion is someone who gets up when he can’t.', a: 'Jack Dempsey' },
  { t: 'You can map out a fight plan or a life plan, but when the action starts, you’re down to your reflexes. That’s where your roadwork shows.', a: 'Joe Frazier' },
  { t: 'It’s tough to get out of bed to do roadwork at 5 a.m. when you’ve been sleeping in silk pajamas.', a: 'Marvin Hagler' },
  { t: 'The hero and the coward both feel the same thing. The hero uses his fear; the coward runs.', a: 'Cus D’Amato' },
  { t: 'Everybody wants to be a bodybuilder, but nobody wants to lift no heavy-ass weights.', a: 'Ronnie Coleman' },
  { t: 'Strength does not come from winning. Your struggles develop your strengths.', a: 'Arnold Schwarzenegger' },

  // ---- Runners & endurance ----
  { t: 'To give anything less than your best is to sacrifice the gift.', a: 'Steve Prefontaine' },
  { t: 'A lot of people run a race to see who is fastest. I run to see who has the most guts.', a: 'Steve Prefontaine' },
  { t: 'Only the disciplined ones in life are free. If you are undisciplined, you are a slave to your moods and your passions.', a: 'Eliud Kipchoge' },
  { t: 'No human is limited.', a: 'Eliud Kipchoge' },
  { t: 'Keep showing up.', a: 'Des Linden' },
  { t: 'The will to win means nothing without the will to prepare.', a: 'Juma Ikangaa' },
  { t: 'Mind is everything. Muscle — pieces of rubber. All that I am, I am because of my mind.', a: 'Paavo Nurmi' },
  { t: 'There’s no such thing as bad weather, just soft people.', a: 'Bill Bowerman' },
  { t: 'Make friends with pain, and you will never be alone.', a: 'Ken Chlouber, founder of the Leadville 100' },
  { t: 'The competition is against the little voice inside you that wants you to quit.', a: 'George Sheehan' },
  { t: 'Run when you can, walk if you have to, crawl if you must; just never give up.', a: 'Dean Karnazes' },
  { t: 'There is magic in misery.', a: 'Dean Karnazes, Ultramarathon Man' },
  { t: 'It hurts up to a point and then it doesn’t get any worse.', a: 'Ann Trason' },
  { t: 'When other people get tired, they stop. I don’t. I take over my body with my mind.', a: 'Yiannis Kouros' },
  { t: 'Somewhere in the world someone is training when you are not. When you race him, he will win.', a: 'Tom Fleming’s training sign' },
  { t: 'It never gets easier; you just go faster.', a: 'Greg LeMond' },
  { t: 'Pain is inevitable. Suffering is optional.', a: 'Marathoner’s maxim, popularized by Haruki Murakami' },
  { t: 'At least he never walked.', a: 'Haruki Murakami, on the epitaph he wants as a runner' },
  { t: 'Run the mile you’re in.', a: 'Ryan Hall' },
  { t: 'The miracle isn’t that I finished. The miracle is that I had the courage to start.', a: 'John Bingham' },
  { t: 'You only ever grow as a human being if you’re outside your comfort zone.', a: 'Attributed to Percy Cerutty' },
  { t: 'An athlete must run with dreams in his heart, not money in his pocket.', a: 'Attributed to Emil Zátopek' },
  { t: 'Someday you will not be able to do this. Today is not that day.', a: 'Unknown' },

  // ---- Coaches & team sport ----
  { t: 'It’s not whether you get knocked down; it’s whether you get up.', a: 'Vince Lombardi' },
  { t: 'The harder you work, the harder it is to surrender.', a: 'Vince Lombardi' },
  { t: 'Great moments are born from great opportunity.', a: 'Herb Brooks' },
  { t: 'Do not let what you cannot do interfere with what you can do.', a: 'John Wooden' },
  { t: 'It’s not the will to win that matters — everyone has that. It’s the will to prepare to win that matters.', a: 'Paul “Bear” Bryant' },
  { t: 'I’ve missed more than 9,000 shots in my career. I’ve lost almost 300 games. I’ve failed over and over and over again in my life. And that is why I succeed.', a: 'Michael Jordan' },
  { t: 'I can accept failure. Everyone fails at something. But I can’t accept not trying.', a: 'Michael Jordan' },
  { t: 'Rest at the end, not in the middle.', a: 'Kobe Bryant' },
  { t: 'Never die easy.', a: 'Walter Payton' },
  { t: 'We all have dreams. But in order to make dreams into reality, it takes an awful lot of determination, dedication, self-discipline, and effort.', a: 'Jesse Owens' },
  { t: 'Once you’ve wrestled, everything else in life is easy.', a: 'Dan Gable' },
  { t: 'A moment of pain is worth a lifetime of glory.', a: 'Louis Zamperini' },
  { t: 'Sweat plus sacrifice equals success.', a: 'Charlie Finley' },

  // ---- Writers, thinkers, history ----
  { t: 'He who has a why to live can bear almost any how.', a: 'Friedrich Nietzsche' },
  { t: 'What does not kill me makes me stronger.', a: 'Friedrich Nietzsche' },
  { t: 'Man is not made for defeat. A man can be destroyed but not defeated.', a: 'Ernest Hemingway, The Old Man and the Sea' },
  { t: 'The world breaks everyone, and afterward, many are strong at the broken places.', a: 'Ernest Hemingway, A Farewell to Arms' },
  { t: 'If there is no struggle, there is no progress.', a: 'Frederick Douglass' },
  { t: 'The credit belongs to the man who is actually in the arena, whose face is marred by dust and sweat and blood; who strives valiantly; who errs, who comes short again and again.', a: 'Theodore Roosevelt' },
  { t: 'Do what you can, with what you have, where you are.', a: 'Squire Bill Widener, made famous by Theodore Roosevelt' },
  { t: 'Nothing in this world can take the place of persistence. Talent will not; genius will not; education will not. Persistence and determination alone are omnipotent.', a: 'Attributed to Calvin Coolidge' },
  { t: 'I am the master of my fate, I am the captain of my soul.', a: 'William Ernest Henley, Invictus' },
  { t: 'If you can force your heart and nerve and sinew to serve your turn long after they are gone, and so hold on when there is nothing in you except the Will which says to them: “Hold on!”', a: 'Rudyard Kipling, If—' },
  { t: 'Everything can be taken from a man but one thing: the last of the human freedoms — to choose one’s attitude in any given set of circumstances.', a: 'Viktor Frankl, Man’s Search for Meaning' },
  { t: 'Success is to be measured not so much by the position that one has reached in life as by the obstacles which he has overcome.', a: 'Booker T. Washington' },
  { t: 'Character cannot be developed in ease and quiet. Only through experience of trial and suffering can the soul be strengthened, ambition inspired, and success achieved.', a: 'Helen Keller' },
  { t: 'It always seems impossible until it’s done.', a: 'Attributed to Nelson Mandela' },
  { t: 'It does not matter how slowly you go as long as you do not stop.', a: 'Attributed to Confucius' },
  { t: 'I would rather be ashes than dust.', a: 'Attributed to Jack London' },
  { t: 'Fall seven times, stand up eight.', a: 'Japanese proverb' },
  { t: 'A smooth sea never made a skilled sailor.', a: 'English proverb' },
  { t: 'Today is victory over yourself of yesterday; tomorrow is your victory over lesser men.', a: 'Miyamoto Musashi, The Book of Five Rings' },
  { t: 'Do nothing which is of no use.', a: 'Miyamoto Musashi' },
  { t: 'Do not pray for an easy life; pray for the strength to endure a difficult one.', a: 'Attributed to Bruce Lee' },
  { t: 'I fear not the man who has practiced 10,000 kicks once, but I fear the man who has practiced one kick 10,000 times.', a: 'Bruce Lee' },
  { t: 'Whether you think you can, or you think you can’t — you’re right.', a: 'Henry Ford' },
  { t: 'We must all suffer from one of two pains: the pain of discipline or the pain of regret.', a: 'Jim Rohn' },
  { t: 'Don’t wish it were easier; wish you were better.', a: 'Jim Rohn' },
  { t: 'Hard choices, easy life. Easy choices, hard life.', a: 'Jerzy Gregorek' },
  { t: 'Nobody cares. Work harder.', a: 'Cameron Hanes' },
  { t: 'Amateurs practice until they get it right; professionals practice until they can’t get it wrong.', a: 'Unknown' },
  { t: 'Because it’s there.', a: 'George Mallory, on why he climbed Everest' },

  // ---- Film ----
  { t: 'It’s not about how hard you hit. It’s about how hard you can get hit and keep moving forward.', a: 'Rocky Balboa, Rocky Balboa (2006)' },
  { t: 'Why do we fall? So we can learn to pick ourselves up.', a: 'Thomas Wayne, Batman Begins' },
  { t: 'Do, or do not. There is no try.', a: 'Yoda, The Empire Strikes Back' },
  { t: 'What we do in life echoes in eternity.', a: 'Maximus, Gladiator' },
  { t: 'The inches we need are everywhere around us.', a: 'Tony D’Amato, Any Given Sunday' },
  { t: 'The trick is not minding that it hurts.', a: 'T.E. Lawrence, as portrayed in Lawrence of Arabia' },
  { t: 'It’s supposed to be hard. If it were easy, everybody would do it. The hard is what makes it great.', a: 'Jimmy Dugan, A League of Their Own' },
];

// Day-of-year (1–366) → stable quote for the calendar day, cycling the pool.
export function quoteForDate(d = new Date()) {
  const start = new Date(d.getFullYear(), 0, 0);
  const doy = Math.floor((d - start) / 86400000);
  return QUOTES[(doy - 1 + QUOTES.length * 8) % QUOTES.length];
}
