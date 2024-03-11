# main.py

from agents.data_analyst import DataAnalyst
from tasks.analyze_data import DataAnalysisTask
from crews.data_analysis_crew import DataAnalysisCrew

# Create instances of your agents and tasks
data_analyst = DataAnalyst(...)
data_analysis_task = DataAnalysisTask(...)

# Instantiate your crew with the agents and tasks
data_analysis_crew = DataAnalysisCrew([data_analyst], [data_analysis_task])

# Kick off the crew process and get results
results = data_analysis_crew.kickoff()
print("Crew Results:", results)
