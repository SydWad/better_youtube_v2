SAVE THE CONTENTS OF THIS FILE AS CLAUDE.md.old REFACTOR THIS FILE BEFORE STARTING PROJECT AND REMOVE THIS MESSAGE.

<!-- Original App located at "*\Extension_Development\better_youtube" only reference it if you need to. -->
<Project Title="Better YouTube v2" description="Chrome/Brave extension to customize the youtube interface. As well as store a permanent and exportable/importable watch history.">
<Style style="Professional and straightforward, Dark/light mode compliant. Dark=Black background, gray boxes, stark white text, red accents. Light=Cream background, light gray boxes, mid-blue text, gold accents." /> 
<Structure file_structure="Keep functions to their own folders (eg; removing shorts pass gets its own folder, removing playlists gets its own folder)"
function_structure="Basic functionality on popup.html additional functionality separated to options.html which opens on another tab."/>
</Project>



<popup.html>

<Header alignment="Text/Header Left, Value/Input/Toggle Right, strict+dynamic" Title="Better YouTube v2" toggle3="Light/Dark/Automatic, Default browser light mode" link{options.html}="settings.png">
<toggle2 icon128.png="toggles extension on or off persistently in box with green and red background representing enabled or disabled. ENABLED/DISABLED text in bold changes based on state, also green or red, but lighter shade than background." default="on" alignment="center" />
</Header>

<Body>
<Text Watch_History="contains total number of entries in Watched\Videos internal history" />
<Text Content_Removed="number of items removed from the current youtube page, including elements" />

<!-- This will control what pages should be effected, if the toggle is off and that page is loaded NO CHANGES SCRIPTING SHOULD RUN. Known issue in v1 was sometimes content would still be edited or removed on disabled pages.
Whenever a toggle is flipped have its state toaster on the left of the toggle for two seconds. -->
<Category Title="Filter Videos From:" toggle_states="off,advanced,on" state.advanced="blue" context.advanced="advanced=defined in options.html" >
<Toggle3 label="Home Page" default="on" target="*/youtube.com,*/m.youtube.com,*/youtu.be" />
<Toggle3 label="Subscriptions" default="on" target="*/feed/subscriptions" />
<Toggle3 label="Video Sidebars" default="on" target="*/watch" />
<Toggle3 label="Channel Pages" default="off" target="*/@" />
<Toggle3 label="Search Results" default="off" target="*/results" />
</Category>

</Body>

</popup.html>



