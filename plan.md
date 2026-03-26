okay I am goin to build this from scratch ,

I am going to use neon, 

lets build ontop of neon, 
postgress and I can move on , 

I want the deployment to be done using a script, 

I am thinkin of deploying on cloudflare and then using neon as a database, 

that is the way to go and build something that is scalable, no vercel or supabase here boys.


- the following
 log in ,
 - the ability to fork and create a new,
 - this show create a new subdomain {}.maindomain
 - the personshoudl be able to configure who sees,
 - peopel shoudl be able to apply to join this is email and/or sms based.
 - send notficiationon about events, doesnt' really need this to be on partiful or luma, but will have perpetual events there, and there is a just a link tot he webiste to apply,
 - - forking gives admin access to the forked projects and alllows or provides all admini preleverlage under thst subdomain,
 - if subdomain name is changed you  do you have access to the preivous on,

 - there is only a singel super admini over all the master accoutn,
 - username: master
 - password: random generated,

- people can post progjects with just a title and and can continuly modify that postiing,
- anyone that is added to that project is automatically able to edited that postiing, anyone that contirubied to that projec ton github as well,

- I kinda wnat to make a git altenrative here, where we are tracking not just the code but allsose the converation that created the code, git is not really well build for this, but hey lets use git for now.
- each project is searchable and the desciriton and title is somethign that can be searched, and each project gets a random image generated based on the title adn user cn re-generatend,
- forke have to also specific they own api keys they dont' get api keys of the mastre brnach,
- as ian idea, I want to build a ggett github for specifically agents, and programming them,

- one more thing , whe we a user uplodes a project, they can upload to multippel branches they are a part of and can request to uploda to a branch, as well, and ofcourse, the not only linke hte opn source proejct butil also their intractions, they can see the intruciton sthey used to build a projec tif they so wish, and it is avalible to people in their to peoplel in their branch they publoced to, actually evey useus shoudl be able to se eevery project even if they it is of another branch, but the traces themselves are special to the club itself, does that make sense? the proejct and descroption are publick but maybe the project as well, but the traces they are kept to the club? does that make sense? I am nto sure , yes it makes sense, 
jand even within a cbranch, it only make sense, peopel will ahave accese to the traces of peopel they hacked with, actually yes there shoudl be a promoption thing where if a person i spart of the lcubl and has hack some nubmer of times they can uplaod, 

and I want there to be a twitter yes a twitter rapi or someething a twitter bot that runs a, I want communicatio to happen in twitter, that is where people are any ways, that is necessary for the clubs growth ,

### decisions made:
- sign up is github-only, keeps things simple and ties into the github collab stuff
- calling the forkable communities "branches" (of the master branch) — internally they're clubs, but user-facing term is "branch"
- accounts are global across all branches, not per-branch
- each branch has one admin (the creator), no role-based access for now
- subdomain renames do NOT keep the old name
- club metadata (date created, forked-from, description) is optional at creation, progressively encouraged
- branches are discoverable via search, including semantic search
- two branches can merge if both admins approve — supported from day one
- you have to be admitted to a branch before you can post projects
- UPDATED: no gatekeeping on uploads — anyone can upload projects
- two user tiers: **hackers** (default, everyone starts here) and **members** (admitted through a process)
- hackers can upload projects and see project + description + try it out, but no traces
- members get full access including traces
- badge system to distinguish hackers from members
- cross-posting: users can post to multiple branches and request to post to branches they're not in
- projects are public to everyone; traces are private to the branch
- within a branch, traces are shared between people who hacked together
- trace visibility is configurable per-project: default is branch-private, but you can open traces to everyone
- project analytics can be made globally public even if traces aren't
- Twitter bot integration for communication and branch growth
- STOPPING HERE — this is the minimum evolvable product for the hacker club

---

# Clean Summary

## Stack
- **Hosting**: Cloudflare
- **Database**: Neon (Postgres)
- **Deployment**: Script-based (no Vercel, no Supabase)

## Accounts
- GitHub-only sign-up (simplifies GitHub integration)
- Accounts are global across all branches
- Single super admin (`master`) with generated password

## Branches
- A fork of the master branch → creates `{name}.maindomain` subdomain
- Each branch has one admin (the creator); role-based access deferred for now
- Branches provide their own API keys (no inheritance from master)
- Subdomain renames do not retain the previous name
- Branch metadata: date created, forked-from, description — all optional at creation, progressively encouraged
- Branches are discoverable via search (including semantic search)
- ~~Two branches can merge if both admins approve~~ (post-MVP)

## User Tiers
- **Hacker** — default state for all users; can upload projects, see project listings + descriptions, try projects out
- **Member** — admitted through an application process (email/SMS-based); gets full access including traces
- Badge distinguishes hackers from members

## Projects
- Anyone can upload a project (no gatekeeping)
- Can post to multiple branches; can request to post to branches you're not in
- Projects are continuously editable by the poster
- Collaborators (added manually or via GitHub contributions) can also edit
- Auto-generated image from title; user can regenerate
- Searchable by title and description
- Links to GitHub repo via URL

## Traces
- The conversations/instructions used to build a project
- **Public**: project title, description, and the project itself
- **Default**: traces are branch-private, visible to members of the branch you posted in who you hacked with
- **Configurable**: per-project toggle to make traces fully public (open to everyone)

## Growth & Communication
- Twitter bot integration — communication happens on Twitter, that's where people are
- Email/SMS notifications for events
- Perpetual listings on Partiful/Luma link back to site for applications

## Future Direction (post-MVP)
- Branch merging (both admins approve)
- Semantic search (regular search first)
- Twitter bot for branch growth
- Cross-posting to branches you're not in
- "Hack" concept and promotion system
- Per-hacker customizable page (their own profile/projects view)
- Customizable branch features — intersects with moa os
- Project analytics visible globally (even when traces are branch-private)
- Git alternative that tracks conversations alongside code
- GitHub-like platform purpose-built for agents
