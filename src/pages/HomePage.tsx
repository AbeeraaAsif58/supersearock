import { Link } from "react-router-dom";
import { AuthHashRedirectHandler } from "@/components/auth/auth-hash-redirect-handler";

export default function HomePage() {
  return (
    <div className="text-[#1A1A1A] selection:bg-[#1A1A1A] selection:text-[#F5F5F3] bg-[#F4F1ED] leading-[1.6]">
      <AuthHashRedirectHandler />
      <div className="fixed inset-0 pointer-events-none z-[-2] hidden md:flex w-full">
        <div className="w-1/4 h-full border-r border-[#E0DDD9]" />
        <div className="w-1/4 h-full border-r border-[#E0DDD9]" />
        <div className="w-1/4 h-full border-r border-[#E0DDD9]" />
        <div className="w-1/4 h-full" />
      </div>

      <nav
        className="transition-all duration-500 flex px-5 md:px-16 bg-[#f7f5f3] w-full z-50 border-[#E0DDD9] border-b py-4 md:py-8 top-0 items-center justify-between"
        id="navbar"
      >
        <div className="text-xl md:text-2xl uppercase tracking-tight text-[#1A1A1A] font-medium flex-1">
          SUPER SEA ROCK REAL ESTATE
        </div>
        <div className="hidden lg:flex gap-12 text-sm uppercase tracking-widest font-light text-[#1A1A1A] justify-center">
          <a href="#dashboard" className="transition-colors duration-300 hover:text-[#E55B3C]">
            Dashboard
          </a>
          <a href="#leads" className="transition-colors duration-300 hover:text-[#E55B3C]">
            Leads
          </a>
          <a href="#pipeline" className="transition-colors duration-300 hover:text-[#E55B3C]">
            Pipeline
          </a>
          <a href="#agents" className="transition-colors duration-300 hover:text-[#E55B3C]">
            Agents
          </a>
        </div>
        <div className="flex items-center gap-4 md:gap-8 flex-1 justify-end">
          <Link
            to="/dashboard"
            className="group inline-flex items-center gap-2 md:gap-3 ring-1 ring-[#E55B3C] hover:bg-[#c94b2f] hover:ring-[#c94b2f] transition-all duration-300 text-xs font-medium uppercase tracking-widest text-white bg-[#E55B3C] rounded-full py-2 pr-2 pl-4 md:pl-5 shadow-lg"
          >
            <span>Open CRM</span>
            <span className="inline-flex h-7 w-7 md:h-8 md:w-8 items-center justify-center group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform text-[#1A1A1A] bg-white rounded-full">
              <span aria-hidden>↗</span>
            </span>
          </Link>
        </div>
      </nav>

      <section
        id="dashboard"
        className="md:min-h-screen flex flex-col md:pt-[18vh] md:px-16 overflow-hidden bg-[#F7F5F2] w-full pt-[8vh] px-5 relative pb-10 md:pb-0"
      >
        <div className="flex flex-col text-center w-full max-w-5xl z-20 mt-0 mr-auto ml-auto relative items-center py-[5vh]">
          <h1 className="text-[2rem] sm:text-4xl md:text-6xl lg:text-[5rem] xl:text-[5.5rem] tracking-tight font-normal text-[#1A1A1A] mb-4 md:mb-6 leading-[1.1] md:leading-[1.05]">
            Real Estate Dashboard.
            <br />
            Faster Closings.
          </h1>
          <p className="text-base sm:text-lg md:text-2xl text-gray-500 font-light tracking-wide max-w-3xl mx-auto">
            Track leads, automate follow-ups, and monitor team performance in real time.
          </p>
        </div>
        <div className="relative z-10 w-full flex items-center justify-center" style={{ marginTop: "-10%" }}>
          <img
            src="https://hoirqrkdgbmvpwutwuwj.supabase.co/storage/v1/object/public/assets/assets/d549fee2-d062-41ab-8ffa-08917fed5e3d_3840w.png"
            alt="Luxury Estate"
            className="object-center md:w-[75%] w-full h-auto max-w-[1500px] object-cover relative"
          />
        </div>
      </section>

      <section
        id="leads"
        className="px-5 md:px-16 relative z-10 border-t border-[#2A2A2A] bg-black text-white overflow-hidden py-20 md:py-[200px]"
      >
        <div className="max-w-[1600px] mx-auto flex flex-col relative z-10 items-center">
          <span className="text-xs md:text-sm uppercase tracking-widest text-[#E55B3C] font-light mb-8 md:mb-16">
            OVERVIEW
          </span>
          <h2 className="text-[1.75rem] sm:text-4xl md:text-6xl lg:text-[5rem] xl:text-[5.5rem] tracking-tight font-normal leading-[1.15] md:leading-[1.05] text-white text-center mb-10 md:mb-20">
            Manage your complete
            <br />
            <span className="text-gray-400">sales workflow.</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 md:gap-6 lg:gap-8 w-full items-center">
            <img src="https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?q=80&w=800" alt="Lead pipeline overview" className="md:col-span-1 w-full aspect-[16/10] md:aspect-[4/5] object-cover" />
            <img src="https://images.unsplash.com/photo-1512917774080-9991f1c4c750?q=80&w=1600" alt="Team dashboard insights" className="md:col-span-2 w-full aspect-[16/10] md:aspect-[4/5] object-cover" />
            <img src="https://images.unsplash.com/photo-1600585154340-be6161a56a0c?q=80&w=800" alt="Follow-up activity panel" className="md:col-span-1 w-full aspect-[16/10] md:aspect-[4/5] object-cover" />
          </div>
        </div>
      </section>

      <section
        id="pipeline"
        className="z-20 flex flex-col bg-[#F4F1ED] border-[#E0DDD9] border-t pb-20 md:pb-24 relative overflow-hidden pt-20 md:pt-48"
      >
        <div className="px-5 md:px-16 z-20 w-full text-[#1A1A1A]">
          <span className="text-xs font-mono uppercase tracking-widest text-[#E55B3C]">KEY METRICS</span>
          <h2 className="text-[1.75rem] sm:text-4xl md:text-6xl lg:text-[5rem] xl:text-[5.5rem] leading-[1.15] md:leading-[1.05] tracking-tight font-normal mt-4">
            Dashboard
            <br />
            <span className="text-gray-400">KPIs.</span>
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 px-5 md:px-16 mt-10">
          {[
            {
              city: "Lead Management",
              title: "New Leads",
              img: "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?q=80&w=1200",
              meta: "Daily • Weekly • Monthly",
              price: "128",
            },
            {
              city: "Agent Performance",
              title: "Active Follow-ups",
              img: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?q=80&w=1200",
              meta: "Completed today • Overdue",
              price: "74",
            },
            {
              city: "Sales Pipeline",
              title: "Conversion Rate",
              img: "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800&q=80",
              meta: "New → Interested → Closed",
              price: "22.4%",
            },
          ].map((item) => (
            <div key={item.title} className="group flex flex-col p-4 md:p-5 border border-[#E0DDD9] bg-white/40 backdrop-blur-md">
              <img src={item.img} alt={item.title} className="aspect-[4/5] w-full object-cover" />
              <div className="mt-5 md:mt-6">
                <span className="text-[11px] font-mono text-gray-500 tracking-widest uppercase">{item.city}</span>
                <h3 className="text-2xl md:text-3xl text-[#1A1A1A] tracking-tight font-normal mt-1">{item.title}</h3>
                <div className="pt-4 mt-4 flex justify-between items-center text-sm text-gray-500 border-t border-[#E0DDD9]">
                  <span>{item.meta}</span>
                  <span className="text-[#1A1A1A] font-normal text-xs uppercase tracking-widest">{item.price}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section
        id="agents"
        className="text-white relative z-10 border-t border-[#2A2A2A] py-20 md:py-[200px] bg-[#0a0a0a]"
      >
        <div className="max-w-[1400px] mx-auto px-5 md:px-16">
          <span className="text-xs md:text-sm uppercase tracking-widest text-[#E55B3C] font-light">CORE MODULES</span>
          <h2 className="text-[1.75rem] sm:text-4xl md:text-6xl lg:text-[5rem] xl:text-[5.5rem] tracking-tight font-normal leading-[1.15] md:leading-[1.05] text-white mt-6 mb-12 md:mb-20">
            Smart automation.
            <br />
            Better productivity.
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 w-full">
            {["Lead Distribution", "Follow-Up Management", "Agent Activity Tracking", "Role Permissions"].map((service, i) => (
              <div key={service} className="p-8 border border-[#2A2A2A] bg-white/[0.02] hover:bg-white/[0.05] transition-all duration-500">
                <div className="text-xs text-gray-500 font-mono tracking-widest mb-6">{`0${i + 1}`}</div>
                <h3 className="text-xl md:text-2xl tracking-tight font-normal text-white mb-3">{service}</h3>
                <p className="text-gray-400 font-light leading-relaxed text-sm md:text-base tracking-wide">
                  Built for real estate teams to reduce missed follow-ups and improve lead-to-close efficiency.
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="relative z-10 border-t border-[#2A2A2A] bg-[#151515] text-white py-20 md:py-[200px]">
        <div className="max-w-[1400px] mx-auto px-5 md:px-16">
          <div className="text-center mb-10 md:mb-16">
            <span className="text-xs md:text-sm uppercase tracking-widest text-[#E55B3C] font-light">PIPELINE FILTERS</span>
            <h2 className="text-[1.75rem] sm:text-4xl md:text-6xl lg:text-[5rem] xl:text-[5.5rem] leading-[1.15] md:leading-[1.05] text-white tracking-tight font-normal mt-6">
              Filter your <span className="text-gray-500">pipeline.</span>
            </h2>
          </div>
          <div className="border border-white/10 p-6 sm:p-8 md:p-16 lg:p-20 bg-white/[0.04] backdrop-blur-3xl">
            <form className="grid grid-cols-1 md:grid-cols-3 gap-10 md:gap-12 lg:gap-24 w-full">
              <div>
                <label className="block text-[10px] uppercase tracking-[0.25em] text-gray-400 mb-4 md:mb-5 font-medium">Lead Status</label>
                <div className="border-b border-white/10 pb-5 text-base md:text-lg text-white font-light tracking-wide">New / Contacted / Interested</div>
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-[0.25em] text-gray-400 mb-4 md:mb-5 font-medium">Assigned Agent</label>
                <div className="border-b border-white/10 pb-5 text-base md:text-lg text-white font-light tracking-wide">All agents / Team-wise</div>
              </div>
              <div>
                <div className="flex justify-between mb-4 md:mb-5">
                  <label className="block text-[10px] uppercase tracking-[0.25em] text-gray-400 font-medium">Budget Range</label>
                  <span className="text-[10px] text-white font-mono tracking-widest">10L - 5Cr+</span>
                </div>
                <div className="border-b border-white/10 pb-5">
                  <input type="range" min={10} max={100} defaultValue={30} className="premium-slider w-full" />
                </div>
              </div>
            </form>
          </div>
        </div>
      </section>

      <section className="text-[#1A1A1A] relative z-10 border-t border-[#E0DDD9] bg-[#F4F1ED] py-20 md:py-[200px]">
        <div className="max-w-[1400px] mx-auto px-5 md:px-16">
          <span className="text-xs md:text-sm uppercase tracking-widest text-[#E55B3C] font-light">WORKFLOW</span>
          <h2 className="text-[1.75rem] sm:text-4xl md:text-6xl lg:text-[5rem] xl:text-[5.5rem] tracking-tight font-normal leading-[1.15] md:leading-[1.05] mt-6 mb-12 md:mb-20">
            New leads to
            <br />
            <span className="text-gray-400">closed deals.</span>
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 md:gap-6">
            {[
              {
                stage: "01",
                title: "New Lead",
                description: "Capture manual, bulk CSV, or website form leads with duplicate checks.",
              },
              {
                stage: "02",
                title: "Assigned",
                description: "Auto-assign by round robin or area rules, or manually assign by admin.",
              },
              {
                stage: "03",
                title: "Follow-up",
                description: "Track notes, calls, and tasks with daily reminders and overdue alerts.",
              },
              {
                stage: "04",
                title: "Interested",
                description: "Qualify high-intent leads, schedule visits, and monitor conversion readiness.",
              },
              {
                stage: "05",
                title: "Closed / Lost",
                description: "Finalize outcomes and analyze win rates to improve pipeline performance.",
              },
            ].map((item) => (
              <div
                key={item.title}
                className="border border-[#E0DDD9] bg-white/60 p-6 md:p-7 flex flex-col gap-4 min-h-[230px]"
              >
                <span className="text-xs uppercase tracking-[0.2em] text-[#E55B3C] font-medium">
                  {item.stage}
                </span>
                <h3 className="text-xl md:text-2xl text-[#1A1A1A] tracking-tight font-normal">
                  {item.title}
                </h3>
                <p className="text-sm md:text-base text-gray-500 font-light leading-relaxed tracking-wide">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="relative z-10 overflow-hidden border-t border-[#2A2A2A] bg-[#151515] text-white py-20 md:py-[200px]">
        <div className="max-w-[900px] mx-auto px-5 md:px-8 text-center relative flex flex-col items-center z-10">
          <p className="text-xl sm:text-3xl md:text-5xl leading-[1.3] md:leading-[1.2] text-white mb-8 md:mb-14 tracking-tight font-light">
            &quot;This CRM gives our team full visibility on lead assignment, follow-up reminders, and agent performance in one clean dashboard.&quot;
          </p>
          <div className="flex flex-col items-center gap-2 md:gap-3">
            <h4 className="text-xs md:text-sm font-medium tracking-widest text-white uppercase">Sales Admin</h4>
            <span className="text-xs uppercase tracking-widest text-gray-400 font-light">Real Estate Agency</span>
          </div>
        </div>
      </section>

      <section className="bg-[#F4F1ED] text-[#1A1A1A] relative z-10 flex items-center justify-center overflow-hidden border-t border-[#E0DDD9] py-20 md:py-[200px]">
        <div className="relative z-10 text-center px-5 md:px-8 max-w-3xl mx-auto">
          <span className="text-xs md:text-sm uppercase tracking-widest text-[#E55B3C] font-light">READY TO START</span>
          <h2 className="text-[1.75rem] sm:text-4xl md:text-6xl lg:text-[5rem] xl:text-[5.5rem] tracking-tight font-normal leading-[1.15] md:leading-[1.05] mb-6 md:mb-10 mt-6">
            Launch your
            <br />
            <span className="text-gray-400">CRM dashboard.</span>
          </h2>
          <p className="text-base md:text-lg font-light mb-8 md:mb-14 max-w-md mx-auto tracking-wide text-gray-500">
            Cloud-based, secure, and scalable CRM for lead handling, agent coordination, and performance insights.
          </p>
        </div>
      </section>

      <footer className="pb-8 md:pb-12 px-5 md:px-16 relative z-10 border-t border-[#E0DDD9] bg-[#F4F1ED] pt-12 md:pt-[140px]">
        <div className="max-w-[1400px] mx-auto relative z-10">
          <div className="text-4xl md:text-5xl lg:text-7xl uppercase mb-8 tracking-tighter font-normal text-[#1A1A1A] leading-none">
            SUPER SEA ROCK REAL ESTATE
          </div>
          <div className="flex flex-col md:flex-row justify-between items-center pt-6 md:pt-8 border-t border-[#E0DDD9] text-xs uppercase tracking-widest text-gray-500 font-light gap-4">
            <p>© 2026 Super Sea Rock Real Estate Dashboard</p>
            <div className="flex gap-8 md:gap-10">
              <a href="#" className="hover:text-[#1A1A1A] transition-colors">Terms</a>
              <a href="#" className="hover:text-[#1A1A1A] transition-colors">Privacy</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
